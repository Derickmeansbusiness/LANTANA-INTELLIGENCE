/**
 * Pure finance helpers shared by the server and the UI: bank statement CSV
 * parsing, aging buckets, P&L assembly and runway. No I/O here; unit-tested.
 */

// ---------------------------------------------------------------- CSV

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF, optional BOM. Detects ; and tab separators. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].reduce((best, s) => (count(firstLine, s) > count(firstLine, best) ? s : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function count(s: string, ch: string) {
  return s.split(ch).length - 1;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/**
 * Bank dates. UAE banks print day-first, so "03/04/2026" is 3 April.
 * Accepts 2026-04-03, 03/04/2026, 03-04-2026, 03.04.2026, 3 Apr 2026, 03-Apr-26.
 */
export function parseBankDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (r) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-](\d{2}|\d{4})$/))) {
    d = Number(r[1]);
    m = MONTHS[r[2].toLowerCase()] ?? 0;
    y = Number(r[3]);
  } else return null;
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "1,234.50" → 1234.5; "(1,234.50)" and "1,234.50-" and "-1234.5" → −1234.5; "" → null. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/[A-Z]{3}\s*/g, "").replace(/\s/g, "");
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    neg = !neg;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    neg = !neg;
    s = s.slice(1);
  }
  if (s.startsWith("+")) s = s.slice(1);
  s = s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return neg ? -n : n;
}

export type ColumnMap = {
  date: number;
  description: number;
  /** Either one signed amount column… */
  amount?: number | null;
  /** …or separate debit (money out) and credit (money in) columns. */
  debit?: number | null;
  credit?: number | null;
  reference?: number | null;
};

/** Best guess at which column is which, from the header row. */
export function guessColumns(header: string[]): ColumnMap | null {
  const h = header.map((x) => x.trim().toLowerCase());
  const find = (...needles: RegExp[]) => {
    for (const n of needles) {
      const i = h.findIndex((x) => n.test(x));
      if (i >= 0) return i;
    }
    return -1;
  };
  const date = find(/^(transaction |txn |value |posting )?date/, /date/);
  const description = find(/description|narrative|details|particulars|memo|remarks/);
  const amount = find(/^amount|^amt|signed/);
  const debit = find(/debit|withdraw|money out|paid out/);
  const credit = find(/credit|deposit|money in|paid in/);
  const reference = find(/^ref|reference|cheque|transaction id/);
  if (date < 0 || description < 0) return null;
  if (amount < 0 && (debit < 0 || credit < 0)) return null;
  return {
    date,
    description,
    amount: amount >= 0 ? amount : null,
    debit: amount >= 0 ? null : debit,
    credit: amount >= 0 ? null : credit,
    reference: reference >= 0 && reference !== description ? reference : null,
  };
}

export type StatementLine = { row: number; date: string; description: string; amount: number; reference: string | null };
export type StatementProblem = { row: number; problem: string };

/** Normalise data rows (header excluded) into signed lines, collecting rows we can't read. */
export function readStatement(rows: string[][], map: ColumnMap): { lines: StatementLine[]; problems: StatementProblem[] } {
  const lines: StatementLine[] = [];
  const problems: StatementProblem[] = [];
  rows.forEach((r, i) => {
    const row = i + 2; // 1-based, after the header
    const date = parseBankDate(r[map.date] ?? "");
    const description = (r[map.description] ?? "").trim().replace(/\s+/g, " ");
    let amount: number | null;
    if (map.amount != null) amount = parseAmount(r[map.amount] ?? "");
    else {
      const out = parseAmount(r[map.debit ?? -1] ?? "");
      const inn = parseAmount(r[map.credit ?? -1] ?? "");
      amount = out == null && inn == null ? null : (inn ?? 0) - Math.abs(out ?? 0);
    }
    if (!date) return void problems.push({ row, problem: `Can't read the date "${r[map.date] ?? ""}"` });
    if (!description) return void problems.push({ row, problem: "No description" });
    if (amount == null || amount === 0) return void problems.push({ row, problem: "No amount" });
    const reference = map.reference != null ? (r[map.reference] ?? "").trim() || null : null;
    lines.push({ row, date, description, amount, reference });
  });
  return { lines, problems };
}

/**
 * Stable identity for an imported line, so importing the same statement twice
 * skips what's already there. Identical lines in one file are told apart by
 * their occurrence number. The caller hashes the returned keys.
 */
export function importKeys(bankAccountId: string | null, currency: string, lines: { date: string; description: string; amount: number }[]) {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    const base = [bankAccountId ?? "-", currency, l.date, l.amount.toFixed(2), l.description.toLowerCase().replace(/\s+/g, " ").trim()].join("|");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}#${n}`;
  });
}

// ---------------------------------------------------------------- aging

export const AGING_BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export function agingBucket(dueDate: string, today: string): AgingBucket {
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

/** Sum open items by bucket; amounts already in one currency. */
export function agingSummary(items: { due_date: string; amount: number }[], today: string) {
  const out: Record<AgingBucket, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const it of items) out[agingBucket(it.due_date, today)] += it.amount;
  return out;
}

// ---------------------------------------------------------------- P&L

export type MonthlyRow = { month: string; account_id: string | null; code: string | null; name: string | null; type: string | null; amount_aed: number; missing_fx: number };
export type PnlLine = { key: string; code: string | null; name: string; type: "income" | "expense" | "uncategorised" | "other"; byMonth: Record<string, number>; total: number };

/** Months from..to inclusive as YYYY-MM-01. */
export function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}-01`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/**
 * Shape monthly account totals into P&L lines. Income stays positive, expenses
 * are shown positive (as costs). Balance-sheet accounts are left out.
 */
export function buildPnl(rows: MonthlyRow[], months: string[]) {
  const lines = new Map<string, PnlLine>();
  let missingFx = 0;
  for (const r of rows) {
    missingFx += r.missing_fx;
    const type = r.account_id == null ? "uncategorised" : r.type === "income" ? "income" : r.type === "expense" ? "expense" : "other";
    if (type === "other") continue;
    const key = r.account_id ?? "uncategorised";
    const line = lines.get(key) ?? { key, code: r.code, name: r.name ?? "Not categorised yet", type, byMonth: {}, total: 0 };
    const v = type === "income" ? Number(r.amount_aed) : -Number(r.amount_aed);
    const month = r.month.slice(0, 10);
    line.byMonth[month] = (line.byMonth[month] ?? 0) + v;
    line.total += v;
    lines.set(key, line);
  }
  const sorted = [...lines.values()].sort((a, b) => (a.code ?? "zzz").localeCompare(b.code ?? "zzz"));
  const income = sorted.filter((l) => l.type === "income");
  const expense = sorted.filter((l) => l.type !== "income");
  const sumBy = (ls: PnlLine[]) => Object.fromEntries(months.map((m) => [m, ls.reduce((s, l) => s + (l.byMonth[m] ?? 0), 0)]));
  const incomeByMonth = sumBy(income);
  const expenseByMonth = sumBy(expense);
  const netByMonth = Object.fromEntries(months.map((m) => [m, incomeByMonth[m] - expenseByMonth[m]]));
  const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  return {
    income,
    expense,
    incomeByMonth,
    expenseByMonth,
    netByMonth,
    totals: { income: total(incomeByMonth), expense: total(expenseByMonth), net: total(netByMonth) },
    missingFx,
  };
}

/** Months of cash left at the average net outflow of the trailing months; null when cash is growing. */
export function runwayMonths(cash: number | null, monthlyNet: number[]): number | null {
  if (cash == null || monthlyNet.length === 0) return null;
  const avg = monthlyNet.reduce((a, b) => a + b, 0) / monthlyNet.length;
  if (avg >= 0) return null;
  return Math.max(0, cash / -avg);
}
