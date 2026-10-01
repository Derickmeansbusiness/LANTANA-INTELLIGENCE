/**
 * Pure HR helpers: leave days, end-of-service gratuity, the WPS salary file
 * and checklist templates. No I/O; unit-tested.
 */

export const LEAVE_KINDS = ["annual", "sick", "maternity", "parental", "compassionate", "study", "hajj", "unpaid", "other"] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contractor", "intern"] as const;
export const EMPLOYEE_STATUSES = ["onboarding", "active", "offboarding", "left"] as const;

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Monday–Friday days between two dates inclusive (the UAE weekend is Saturday–Sunday). Public holidays aren't known here. */
export function workingDays(start: string, end: string) {
  if (end < start) return 0;
  let n = 0;
  for (let t = utc(start); t <= utc(end); t += DAY) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

/** Whole calendar days between two dates inclusive. */
export function calendarDays(start: string, end: string) {
  return end < start ? 0 : Math.round((utc(end) - utc(start)) / DAY) + 1;
}

/**
 * End-of-service gratuity under the UAE Labour Law (Federal Decree-Law
 * 33/2021, art. 51), which RAKEZ free-zone employers follow:
 * 21 days' basic wage per year for the first five years, 30 days per year
 * after that, pro rata for part years, nothing before one year of service,
 * capped at two years' total wage. Daily wage = basic × 12 / 365.
 * An estimate for planning; unpaid leave and deductions are not taken off.
 */
export function gratuity(basicMonthlyMinor: number, start: string, end: string) {
  const days = calendarDays(start, end);
  const years = days / 365;
  if (years < 1) return { minor: 0, years, eligible: false };
  const daily = (basicMonthlyMinor * 12) / 365;
  const first = Math.min(years, 5) * 21 * daily;
  const rest = Math.max(0, years - 5) * 30 * daily;
  const cap = basicMonthlyMinor * 24;
  return { minor: Math.round(Math.min(first + rest, cap)), years, eligible: true };
}

// ---------------------------------------------------------------- WPS

export type WpsRow = {
  full_name: string;
  person_code: string | null;
  routing_code: string | null;
  iban: string | null;
  days_paid: number;
  fixed_minor: number;
  variable_minor: number;
  start_date: string;
  end_date: string;
  leave_days?: number;
};
export type WpsInput = {
  period: string;
  currency: string;
  employer_id: string | null;
  employer_bank_code: string | null;
  rows: WpsRow[];
};

const major = (minor: number) => (minor / 100).toFixed(2);

/**
 * Salary Information File (SIF) for the UAE Wage Protection System: one EDR
 * line per employee and an SCR control line. Returns the problems instead
 * when a required number is missing. Confirm the layout with your bank or
 * exchange house before the first submission; agents differ in small ways.
 */
export function buildSif(input: WpsInput, now: Date): { ok: true; fileName: string; content: string } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  if (input.currency !== "AED") problems.push("WPS files are in AED.");
  if (!/^\d{13}$/.test(input.employer_id ?? "")) problems.push("Add the 13-digit MOHRE establishment ID (Payroll → WPS details).");
  if (!/^\d{9}$/.test(input.employer_bank_code ?? "")) problems.push("Add the employer's 9-digit bank routing code (Payroll → WPS details).");
  for (const r of input.rows) {
    if (!/^\d{14}$/.test(r.person_code ?? "")) problems.push(`${r.full_name}: no 14-digit MOHRE person code.`);
    if (!/^\d{9}$/.test(r.routing_code ?? "")) problems.push(`${r.full_name}: no 9-digit bank routing (agent) code.`);
    if (!/^AE\d{21}$/.test(r.iban ?? "")) problems.push(`${r.full_name}: no UAE IBAN.`);
  }
  if (!input.rows.length) problems.push("Nobody is on this run.");
  if (problems.length) return { ok: false, problems };

  const p = (n: number) => String(n).padStart(2, "0");
  const dubai = new Date(now.getTime() + 4 * 3600_000);
  const date = `${dubai.getUTCFullYear()}-${p(dubai.getUTCMonth() + 1)}-${p(dubai.getUTCDate())}`;
  const time = `${p(dubai.getUTCHours())}${p(dubai.getUTCMinutes())}`;
  const month = `${input.period.slice(5, 7)}${input.period.slice(0, 4)}`;
  const edr = input.rows.map((r) =>
    ["EDR", r.person_code, r.routing_code, r.iban, r.start_date, r.end_date, r.days_paid, major(r.fixed_minor), major(r.variable_minor), r.leave_days ?? 0].join(","),
  );
  const total = input.rows.reduce((s, r) => s + r.fixed_minor + r.variable_minor, 0);
  const scr = ["SCR", input.employer_id, input.employer_bank_code, date, time, month, edr.length, major(total), "AED", `LANTANA-${month}`].join(",");
  const stamp = `${String(dubai.getUTCFullYear()).slice(2)}${p(dubai.getUTCMonth() + 1)}${p(dubai.getUTCDate())}${time}${p(dubai.getUTCSeconds())}`;
  return { ok: true, fileName: `${input.employer_id}${stamp}.SIF`, content: [...edr, scr].join("\r\n") + "\r\n" };
}

// ---------------------------------------------------------------- checklists

/** Starting points for UAE onboarding and offboarding; edited per person afterwards. */
export const CHECKLIST_TEMPLATES: Record<"onboarding" | "offboarding", { title: string; dueInDays: number }[]> = {
  onboarding: [
    { title: "Signed offer letter on file", dueInDays: -7 },
    { title: "MOHRE employment contract signed", dueInDays: 0 },
    { title: "Entry permit and change of status", dueInDays: 5 },
    { title: "Medical fitness test and Emirates ID biometrics", dueInDays: 15 },
    { title: "Residence visa stamped", dueInDays: 25 },
    { title: "Health insurance enrolled", dueInDays: 0 },
    { title: "Salary account opened and added to WPS", dueInDays: 30 },
    { title: "Laptop, email and Lantana Command login", dueInDays: 0 },
    { title: "Confidentiality undertaking signed", dueInDays: 0 },
  ],
  offboarding: [
    { title: "Resignation or termination letter on file, notice period agreed", dueInDays: -30 },
    { title: "Handover of deals, documents and contacts", dueInDays: -5 },
    { title: "Final settlement calculated (salary, leave, gratuity)", dueInDays: -3 },
    { title: "Final settlement paid through WPS", dueInDays: 14 },
    { title: "Residence visa and labour card cancelled", dueInDays: 30 },
    { title: "Health insurance cancelled", dueInDays: 30 },
    { title: "Laptop returned; email and Lantana Command access removed", dueInDays: 0 },
  ],
};
