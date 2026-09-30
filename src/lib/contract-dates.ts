import { daysBetween, shiftDate } from "@/lib/dates";

export const ALERT_THRESHOLDS = [90, 60, 30, 7] as const;

export type KeyDate = { kind: "notice_deadline" | "contract_end" | "survival_end"; label: string; date: string; daysLeft: number };

const addMonths = (iso: string, months: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  // Clamp to the month's last day (31 Jan + 1 month = 28/29 Feb), as Postgres does.
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
};

/**
 * The dates that matter on a contract, in order: notice deadline for
 * auto-renewals, end of term, and when each surviving clause lapses. The
 * expiry alert job (private.run_expiry_alerts) watches the same dates.
 */
export function keyDates(
  k: { end_date: string | null; renewal_type: string; notice_period_days: number | null },
  survival: { clause: string; survival_months: number }[],
  today: string,
): KeyDate[] {
  const out: KeyDate[] = [];
  if (k.end_date) {
    if (k.renewal_type === "auto_renew" && k.notice_period_days != null) {
      const date = shiftDate(k.end_date, -k.notice_period_days);
      out.push({ kind: "notice_deadline", label: `Last day to give ${k.notice_period_days}-day notice`, date, daysLeft: daysBetween(today, date) });
    }
    out.push({ kind: "contract_end", label: k.renewal_type === "auto_renew" ? "Renews automatically" : "Term ends", date: k.end_date, daysLeft: daysBetween(today, k.end_date) });
    for (const s of survival) {
      const date = addMonths(k.end_date, s.survival_months);
      out.push({ kind: "survival_end", label: `${s.clause} lapses`, date, daysLeft: daysBetween(today, date) });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export { addMonths };
