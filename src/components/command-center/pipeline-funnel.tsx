"use client";

import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCompact } from "@/lib/money";
import type { StageRow } from "@/server/command-center";

/**
 * Pipeline by stage as horizontal bars (one series, one hue). Bar length is
 * stage value in USD; the deal count sits beside it as text.
 */
export function PipelineFunnel({ stages }: { stages: StageRow[] }) {
  const open = stages.filter((s) => !s.is_terminal);
  const won = stages.find((s) => s.is_won);
  const lost = stages.find((s) => s.is_terminal && !s.is_won);
  const max = Math.max(...open.map((s) => s.value_usd), 1);
  const total = open.reduce((a, s) => a + s.value_usd, 0);
  const weighted = open.reduce((a, s) => a + s.weighted_usd, 0);

  if (open.every((s) => s.deal_count === 0)) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No open deals yet. Deals you add in Phase 2 will appear here by stage.
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-2">
        {open.map((s) => (
          <li key={s.key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="grid cursor-default grid-cols-[7.5rem_1fr_auto] items-center gap-3 rounded-sm py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[9rem_1fr_auto]" tabIndex={0}>
                  <span className="truncate text-xs text-muted-foreground">{s.label}</span>
                  <span className="relative h-2.5 rounded-r-[4px] bg-surface-2">
                    {s.value_usd > 0 && (
                      <span
                        className="absolute inset-y-0 left-0 rounded-r-[4px] bg-gold-soft transition-[width] duration-500 ease-out"
                        style={{ width: `${Math.max(2, (s.value_usd / max) * 100)}%` }}
                      />
                    )}
                  </span>
                  <span className="num w-20 text-right text-xs">
                    {s.deal_count > 0 ? (
                      <>
                        {formatCompact(s.value_usd, "USD")} <span className="text-muted-foreground">· {s.deal_count}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="num">
                {s.label}: {s.deal_count} {s.deal_count === 1 ? "deal" : "deals"} · {formatCompact(s.value_usd, "USD")} · weighted {formatCompact(s.weighted_usd, "USD")}
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
      <div className="num mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>
          Open <span className="text-foreground">{formatCompact(total, "USD")}</span>
        </span>
        <span>
          Weighted <span className="text-foreground">{formatCompact(weighted, "USD")}</span>
        </span>
        {won && (
          <span>
            Won <span className="text-foreground">{won.deal_count}</span>
          </span>
        )}
        {lost && (
          <span>
            Lost <span className="text-foreground">{lost.deal_count}</span>
          </span>
        )}
        <Link href="/deals" className="ml-auto text-gold-ink hover:underline">
          Open pipeline
        </Link>
      </div>
    </div>
  );
}
