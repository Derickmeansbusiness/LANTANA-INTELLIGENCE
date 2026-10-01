import { describe, expect, it } from "vitest";
import { agingBucket, agingSummary, buildPnl, guessColumns, importKeys, monthsBetween, parseAmount, parseBankDate, parseCsv, readStatement, runwayMonths } from "./finance";

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, CRLF and a BOM", () => {
    expect(parseCsv('﻿Date,Description,Amount\r\n01/09/2026,"Rent, Sept","-2,500.00"\r\n02/09/2026,"He said ""hi""",10\r\n')).toEqual([
      ["Date", "Description", "Amount"],
      ["01/09/2026", "Rent, Sept", "-2,500.00"],
      ["02/09/2026", 'He said "hi"', "10"],
    ]);
  });
  it("detects semicolon separators and skips blank lines", () => {
    expect(parseCsv("a;b\n\n1;2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseBankDate", () => {
  it("reads UAE day-first dates and ISO", () => {
    expect(parseBankDate("03/04/2026")).toBe("2026-04-03");
    expect(parseBankDate("3-4-26")).toBe("2026-04-03");
    expect(parseBankDate("2026-04-03")).toBe("2026-04-03");
    expect(parseBankDate("03 Apr 2026")).toBe("2026-04-03");
    expect(parseBankDate("03-Apr-26")).toBe("2026-04-03");
  });
  it("rejects impossible dates", () => {
    expect(parseBankDate("31/02/2026")).toBeNull();
    expect(parseBankDate("13/13/2026")).toBeNull();
    expect(parseBankDate("yesterday")).toBeNull();
  });
});

describe("parseAmount", () => {
  it("reads signs, brackets and thousands separators", () => {
    expect(parseAmount("1,234.50")).toBe(1234.5);
    expect(parseAmount("(1,234.50)")).toBe(-1234.5);
    expect(parseAmount("1,234.50-")).toBe(-1234.5);
    expect(parseAmount("AED -75")).toBe(-75);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
  });
});

describe("statement import", () => {
  it("guesses debit/credit columns and signs them", () => {
    const rows = parseCsv("Value Date,Narrative,Debit,Credit,Reference\n01/09/2026,EMIRATES EK725,1200.00,,R1\n05/09/2026,Advisory fee GS,,36725.00,R2\nbad,x,1,,\n");
    const map = guessColumns(rows[0])!;
    expect(map).toMatchObject({ date: 0, description: 1, debit: 2, credit: 3, reference: 4, amount: null });
    const { lines, problems } = readStatement(rows.slice(1), map);
    expect(lines.map((l) => l.amount)).toEqual([-1200, 36725]);
    expect(problems).toEqual([{ row: 4, problem: 'Can\'t read the date "bad"' }]);
  });
  it("gives identical lines distinct keys, stable across re-imports", () => {
    const l = { date: "2026-09-01", description: "Coffee  ", amount: -12 };
    const a = importKeys("bank", "AED", [l, l]);
    expect(a[0]).not.toBe(a[1]);
    expect(importKeys("bank", "AED", [l, l])).toEqual(a);
  });
});

describe("aging", () => {
  it("buckets by days past due", () => {
    expect(agingBucket("2026-10-05", "2026-10-01")).toBe("current");
    expect(agingBucket("2026-09-30", "2026-10-01")).toBe("1-30");
    expect(agingBucket("2026-08-01", "2026-10-01")).toBe("61-90");
    expect(agingBucket("2026-06-01", "2026-10-01")).toBe("90+");
    expect(agingSummary([{ due_date: "2026-09-20", amount: 10 }, { due_date: "2026-09-25", amount: 5 }], "2026-10-01")["1-30"]).toBe(15);
  });
});

describe("P&L", () => {
  const months = monthsBetween("2026-08-01", "2026-09-30");
  it("lists months inclusively across a year end", () => {
    expect(monthsBetween("2026-11-15", "2027-02-01")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01"]);
  });
  it("shows costs as positive and nets per month", () => {
    const p = buildPnl(
      [
        { month: "2026-08-01", account_id: "i", code: "4000", name: "Fees", type: "income", amount_aed: 1000, missing_fx: 0 },
        { month: "2026-08-01", account_id: "e", code: "5000", name: "Rent", type: "expense", amount_aed: -300, missing_fx: 0 },
        { month: "2026-09-01", account_id: null, code: null, name: null, type: null, amount_aed: -50, missing_fx: 1 },
        { month: "2026-09-01", account_id: "b", code: "1000", name: "Bank", type: "asset", amount_aed: 999, missing_fx: 0 },
      ],
      months,
    );
    expect(p.netByMonth).toEqual({ "2026-08-01": 700, "2026-09-01": -50 });
    expect(p.expense.map((l) => l.name)).toEqual(["Rent", "Not categorised yet"]);
    expect(p.totals).toEqual({ income: 1000, expense: 350, net: 650 });
    expect(p.missingFx).toBe(1);
  });
});

describe("runwayMonths", () => {
  it("divides cash by average monthly net outflow", () => {
    expect(runwayMonths(60000, [-20000, -10000])).toBe(4);
    expect(runwayMonths(60000, [5000, -1000])).toBeNull();
    expect(runwayMonths(null, [-1])).toBeNull();
  });
});
