"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/agent/markdown";
import { fmtDubai } from "@/lib/dates";
import { generateBriefingAction } from "@/server/actions/agent";
import type { Briefing } from "@/server/agent/briefing";

export function AiBriefing({ initial, enabled, fallback, icon }: { initial: Briefing | null; enabled: boolean; fallback: string[]; icon: React.ReactNode }) {
  const [briefing, setBriefing] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const asked = useRef(false);

  const run = (force: boolean) =>
    start(async () => {
      const r = await generateBriefingAction(force);
      if (r.ok) {
        setBriefing(r.data);
        setError(null);
      } else setError(r.error);
    });

  // First visit of the day: write it in the background.
  useEffect(() => {
    if (enabled && !initial && !asked.current) {
      asked.current = true;
      run(false);
    }
  }, [enabled, initial]);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            {icon} Morning briefing
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
            {briefing
              ? `Written by Ask Lantana at ${fmtDubai(briefing.created_at, "HH:mm")} from your live data.`
              : pending
                ? "Ask Lantana is writing today's briefing…"
                : enabled
                  ? (error ?? "Rule-based summary from live data.")
                  : "Rule-based summary from live data. Add an Anthropic API key for the written briefing."}
          </p>
        </div>
        {enabled && (
          <Button variant="ghost" size="icon-sm" aria-label="Regenerate briefing" disabled={pending} onClick={() => run(true)}>
            {pending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
          </Button>
        )}
      </div>
      <div className="mt-3">
        {briefing ? (
          <Markdown text={briefing.content} />
        ) : (
          <ul className="space-y-1.5 text-sm leading-relaxed">
            {fallback.map((l) => (
              <li key={l} className="flex gap-2">
                <span className="mt-2.5 size-1 shrink-0 rounded-full bg-gold-soft" />
                <span className="num">{l}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
