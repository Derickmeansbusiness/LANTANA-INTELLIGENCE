import { TZDate } from "@date-fns/tz";
import { addDays, format, parseISO, differenceInCalendarDays, startOfWeek } from "date-fns";

export const TZ = "Asia/Dubai";

/** Today's calendar date in Dubai as YYYY-MM-DD. */
export function todayDubai(now: Date = new Date()): string {
  return format(new TZDate(now, TZ), "yyyy-MM-dd");
}

export function nowDubai(now: Date = new Date()) {
  return new TZDate(now, TZ);
}

export function isoDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function shiftDate(iso: string, days: number) {
  return isoDate(addDays(parseISO(iso), days));
}

export function daysBetween(fromIso: string, toIso: string) {
  return differenceInCalendarDays(parseISO(toIso), parseISO(fromIso));
}

/** Monday-start week containing `iso` (UAE works Mon–Fri). */
export function weekDays(iso: string): string[] {
  const start = startOfWeek(parseISO(iso), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => isoDate(addDays(start, i)));
}

export function fmtDate(iso: string | null | undefined, pattern = "d MMM yyyy") {
  if (!iso) return "";
  return format(parseISO(iso), pattern);
}

/** Format a timestamp in Dubai time. */
export function fmtDubai(ts: string | Date, pattern = "d MMM, HH:mm") {
  return format(new TZDate(typeof ts === "string" ? new Date(ts) : ts, TZ), pattern);
}

export function greeting(now: Date = new Date()) {
  const h = nowDubai(now).getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function relativeTime(ts: string, now: Date = new Date()) {
  const s = Math.round((now.getTime() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtDubai(ts, "d MMM yyyy");
}

export const RANGE_PRESETS = [
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "180d", label: "Last 6 months", days: 180 },
  { key: "365d", label: "Last 12 months", days: 365 },
] as const;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve ?from&to (or ?range) into a validated range; default last 90 days. */
export function resolveRange(params: { from?: string; to?: string; range?: string }, today = todayDubai()) {
  if (params.from && params.to && ISO_RE.test(params.from) && ISO_RE.test(params.to) && params.from <= params.to) {
    const span = daysBetween(params.from, params.to);
    if (span <= 3 * 366) return { from: params.from, to: params.to, key: "custom" as const };
  }
  if (params.range === "ytd") return { from: `${today.slice(0, 4)}-01-01`, to: today, key: "ytd" as const };
  const preset = RANGE_PRESETS.find((p) => p.key === params.range) ?? RANGE_PRESETS[1];
  return { from: shiftDate(today, -preset.days), to: today, key: preset.key };
}
