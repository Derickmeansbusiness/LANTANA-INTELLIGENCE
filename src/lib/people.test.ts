import { describe, expect, it } from "vitest";
import { buildSif, calendarDays, gratuity, workingDays } from "./people";

describe("leave days", () => {
  it("counts Monday to Friday only", () => {
    // Thu 1 Oct 2026 – Wed 7 Oct 2026: Thu, Fri, Mon, Tue, Wed
    expect(workingDays("2026-10-01", "2026-10-07")).toBe(5);
    expect(workingDays("2026-10-03", "2026-10-04")).toBe(0);
    expect(workingDays("2026-10-07", "2026-10-01")).toBe(0);
    expect(calendarDays("2026-10-01", "2026-10-07")).toBe(7);
  });
});

describe("gratuity", () => {
  const basic = 1_000_000; // AED 10,000.00 a month
  it("pays nothing before one year", () => {
    expect(gratuity(basic, "2026-01-01", "2026-10-01")).toMatchObject({ minor: 0, eligible: false });
  });
  it("pays 21 days a year for the first five years", () => {
    const g = gratuity(basic, "2021-10-03", "2026-10-01"); // exactly 5 × 365 days (2024 is a leap year)
    expect(g.eligible).toBe(true);
    expect(g.minor).toBeCloseTo(5 * 21 * ((basic * 12) / 365), -2);
  });
  it("pays 30 days a year after five years, capped at two years' pay", () => {
    const seven = gratuity(basic, "2019-10-03", "2026-10-01"); // 7 × 365 + 2 leap days ≈ 7.0 years
    expect(seven.minor).toBeGreaterThan(gratuity(basic, "2021-10-03", "2026-10-01").minor);
    expect(gratuity(basic, "1990-01-01", "2026-10-01").minor).toBe(basic * 24);
  });
});

describe("WPS salary file", () => {
  const base = {
    period: "2026-09-01",
    currency: "AED",
    employer_id: "1234567890123",
    employer_bank_code: "803320101",
    rows: [
      { full_name: "Test Staff", person_code: "10000000000002", routing_code: "803320101", iban: "AE070330000000000000002", days_paid: 30, fixed_minor: 770000, variable_minor: 50000, start_date: "2026-09-01", end_date: "2026-09-30" },
    ],
  };
  it("writes EDR lines and a matching SCR control line", () => {
    const r = buildSif(base, new Date("2026-09-30T06:05:09Z"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fileName).toBe("1234567890123260930100509.SIF");
    const [edr, scr] = r.content.trim().split("\r\n");
    expect(edr).toBe("EDR,10000000000002,803320101,AE070330000000000000002,2026-09-01,2026-09-30,30,7700.00,500.00,0");
    expect(scr).toBe("SCR,1234567890123,803320101,2026-09-30,1005,092026,1,8200.00,AED,LANTANA-092026");
  });
  it("lists what's missing instead of writing a bad file", () => {
    const r = buildSif({ ...base, employer_id: null, rows: [{ ...base.rows[0], iban: null }] }, new Date());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problems.join(" ")).toMatch(/establishment ID/);
    expect(r.problems.join(" ")).toMatch(/Test Staff: no UAE IBAN/);
  });
});
