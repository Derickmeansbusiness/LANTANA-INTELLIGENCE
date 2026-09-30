import { RefreshCwIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCompact } from "@/lib/money";
import { daysBetween } from "@/lib/dates";
import type { ActivityRow, AttentionItem, KpiResult, WeekEntry } from "@/server/command-center";

/**
 * Until the agent writes the morning briefing (Phase 4), this card states
 * facts computed from the same queries as the rest of the page. No
 * estimates, no prose that the data can't back.
 */
export function BriefingCard({
  attention,
  activity,
  kpis,
  week,
  today,
}: {
  attention: AttentionItem[];
  activity: ActivityRow[];
  kpis: KpiResult;
  week: WeekEntry[];
  today: string;
}) {
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
  if (overdue.length) lines.push(`${overdue.length} overdue ${overdue.length === 1 ? "task" : "tasks"}, the oldest: ${overdue.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0].title}.`);
  for (const n of notices.slice(0, 1)) {
    lines.push(`${n.title}: last day to give notice is in ${daysBetween(today, n.due_date!)} days.`);
  }
  if (moved.length) lines.push(`${moved.length} ${moved.length === 1 ? "deal" : "deals"} moved stage this week: ${moved.map((m) => m.summary.replace(/^moved /, "")).slice(0, 2).join("; ")}.`);
  if (last?.cash_aed != null && last?.burn_aed) {
    const runway = last.cash_aed / last.burn_aed;
    lines.push(`Cash on hand ${formatCompact(last.cash_aed, "AED")} against ${formatCompact(last.burn_aed, "AED")} spent in the last 30 days: about ${runway.toFixed(1)} months of runway at that pace.`);
  }
  lines.push(todays.length ? `${todays.length} ${todays.length === 1 ? "meeting" : "meetings"} today, first at ${todays[0].time}: ${todays[0].title}.` : "No meetings on the calendar today.");

  return (
    <section className="animate-fade-up rounded-lg border bg-surface p-4 sm:p-5" aria-labelledby="briefing-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="briefing-title" className="flex items-center gap-2 text-sm font-medium">
            <SparklesIcon className="size-4 text-gold" /> Morning briefing
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Rule-based summary from live data. The agent writes this from Phase 4.</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Button variant="ghost" size="icon-sm" disabled aria-label="Regenerate briefing (Phase 4)">
                <RefreshCwIcon />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="left">Regenerate · arrives with the agent in Phase 4</TooltipContent>
        </Tooltip>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm leading-relaxed">
        {lines.slice(0, 6).map((l) => (
          <li key={l} className="flex gap-2">
            <span className="mt-2.5 size-1 shrink-0 rounded-full bg-gold-soft" />
            <span className="num">{l}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
