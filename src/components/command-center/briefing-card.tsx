import { SparklesIcon } from "lucide-react";
import { briefingFacts } from "@/lib/briefing-facts";
import type { ActivityRow, AttentionItem, KpiResult, WeekEntry } from "@/server/command-center";
import type { Briefing } from "@/server/agent/briefing";
import { AiBriefing } from "./ai-briefing";

/**
 * Morning briefing. Ask Lantana writes it once per Dubai day per reader (from
 * facts computed under their own permissions) and it is cached. Until it
 * arrives, or without an API key, the rule-based lines from the same facts show.
 */
export function BriefingCard({
  attention,
  activity,
  kpis,
  week,
  today,
  ai,
  enabled,
}: {
  attention: AttentionItem[];
  activity: ActivityRow[];
  kpis: KpiResult;
  week: WeekEntry[];
  today: string;
  ai: Briefing | null;
  enabled: boolean;
}) {
  const { lines } = briefingFacts({ attention, activity, kpis, week, today });
  return (
    <section className="animate-fade-up rounded-lg border bg-surface p-4 sm:p-5" aria-labelledby="briefing-title">
      <AiBriefing initial={ai} enabled={enabled} fallback={lines.slice(0, 6)} icon={<SparklesIcon className="size-4 text-gold" />} />
    </section>
  );
}
