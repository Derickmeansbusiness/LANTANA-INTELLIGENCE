import { formatCompact } from "@/lib/money";
import { daysBetween } from "@/lib/dates";
import type { ActivityRow, AttentionItem, KpiResult, WeekEntry } from "@/server/command-center";

const HREF: Record<string, (id: string) => string> = {
  deal: (id) => `/deals/${id}`,
  organization: (id) => `/partners/${id}`,
  contract: (id) => `/contracts/${id}`,
  document: (id) => `/documents/${id}`,
  task: (id) => `?task=${id}`,
};

/**
 * The facts behind the morning briefing, computed from the same queries as
 * the Command Center. The rule-based card renders `lines`; the AI briefing is
 * written only from `items` and `lines`, so it can't state a number the data
 * doesn't back.
 */
export function briefingFacts(input: { attention: AttentionItem[]; activity: ActivityRow[]; kpis: KpiResult; week: WeekEntry[]; today: string }) {
  const { attention, activity, kpis, week, today } = input;
  const lines: string[] = [];
  const high = attention.filter((a) => a.severity === "high");
  const overdue = attention.filter((a) => a.kind === "task_overdue");
  const notices = attention.filter((a) => a.kind === "notice_deadline" && a.due_date);
  const moved = activity.filter((a) => a.verb === "moved" && daysBetween(a.occurred_at.slice(0, 10), today) <= 7);
  const todays = week.filter((w) => w.day === today && w.kind === "meeting");
  const last = kpis.series[kpis.series.length - 1];

  if (attention.length) {
    lines.push(
      `${attention.length} ${attention.length === 1 ? "item needs" : "items need"} attention, ${high.length} high priority${high[0] ? `. Top of the list: ${high[0].title} (${high[0].detail.toLowerCase()})` : ""}.`,
    );
  } else {
    lines.push("Nothing is overdue or expiring in the next 60 days.");
  }
  if (overdue.length) lines.push(`${overdue.length} overdue ${overdue.length === 1 ? "task" : "tasks"}, the oldest: ${[...overdue].sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0].title}.`);
  for (const n of notices.slice(0, 1)) lines.push(`${n.title}: last day to give notice is in ${daysBetween(today, n.due_date!)} days.`);
  if (moved.length) lines.push(`${moved.length} ${moved.length === 1 ? "deal" : "deals"} moved stage this week: ${moved.map((m) => m.summary.replace(/^moved /, "")).slice(0, 2).join("; ")}.`);
  let runway: string | null = null;
  if (last?.cash_aed != null && last?.burn_aed) {
    runway = (last.cash_aed / last.burn_aed).toFixed(1);
    lines.push(`Cash on hand ${formatCompact(last.cash_aed, "AED")} against ${formatCompact(last.burn_aed, "AED")} spent in the last 30 days: about ${runway} months of runway at that pace.`);
  }
  lines.push(todays.length ? `${todays.length} ${todays.length === 1 ? "meeting" : "meetings"} today, first at ${todays[0].time}: ${todays[0].title}.` : "No meetings on the calendar today.");

  const items = {
    today,
    attention: attention.slice(0, 12).map((a) => ({ severity: a.severity, title: a.title, detail: a.detail, due: a.due_date, href: a.entity_id && HREF[a.entity_type] ? HREF[a.entity_type](a.entity_id) : null })),
    stage_moves_this_week: moved.slice(0, 6).map((m) => ({ what: m.summary, by: m.actor, href: m.entity_id && HREF[m.entity_type] ? HREF[m.entity_type](m.entity_id) : null })),
    meetings_today: todays.map((m) => ({ time: m.time, title: m.title })),
    kpis: last
      ? {
          pipeline_usd: formatCompact(last.pipeline_usd, "USD"),
          advanced_deals: last.advanced_deals,
          capital_introduced_usd: formatCompact(last.capital_introduced_usd, "USD"),
          overdue_tasks: last.overdue_tasks,
          cash_aed: last.cash_aed == null ? "not visible to this reader" : formatCompact(last.cash_aed, "AED"),
          spent_last_30_days_aed: last.burn_aed == null ? "not visible to this reader" : formatCompact(last.burn_aed, "AED"),
          runway_months_at_that_pace: runway,
        }
      : null,
    missing: kpis.missing_fx.map((c) => `FX rate for ${c}`),
  };
  return { lines, items };
}
