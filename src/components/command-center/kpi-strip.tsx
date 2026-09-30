"use client";

import { useEffect, useId, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { ArrowDownRightIcon, ArrowUpRightIcon, LockIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/dates";
import { formatCompact } from "@/lib/money";
import type { KpiPoint, KpiResult } from "@/server/command-center";

type Tile = {
  key: keyof Omit<KpiPoint, "date">;
  label: string;
  format: (n: number) => string;
  /** true when an increase is good news */
  upIsGood: boolean;
  hero?: boolean;
  hiddenReason?: string;
  note?: string;
};

const count = (n: number) => Math.round(n).toLocaleString("en-US");

export function KpiStrip({ kpis, scopeNote }: { kpis: KpiResult; scopeNote?: string }) {
  const tiles: Tile[] = [
    { key: "pipeline_usd", label: "Active pipeline", format: (n) => formatCompact(n, "USD"), upIsGood: true, hero: true, note: scopeNote },
    { key: "advanced_deals", label: "Deals in advanced stage", format: count, upIsGood: true },
    { key: "capital_introduced_usd", label: "Capital introduced YTD", format: (n) => formatCompact(n, "USD"), upIsGood: true },
    {
      key: "cash_aed",
      label: "Cash on hand",
      format: (n) => formatCompact(n, "AED"),
      upIsGood: true,
      hiddenReason: kpis.can_see_cash ? undefined : kpis.role === "principal" ? "Verify MFA to view" : "Principals only",
    },
    {
      key: "burn_aed",
      label: "Monthly burn (30d)",
      format: (n) => formatCompact(n, "AED"),
      upIsGood: false,
      hiddenReason: kpis.can_see_burn ? undefined : "Management only",
    },
    { key: "overdue_tasks", label: "Tasks overdue", format: count, upIsGood: false },
  ];

  return (
    <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t, i) => (
        <KpiTile key={t.key} tile={t} series={kpis.series} index={i} />
      ))}
    </section>
  );
}

function KpiTile({ tile, series, index }: { tile: Tile; series: KpiPoint[]; index: number }) {
  const values = series.map((p) => p[tile.key] as number | null);
  const last = values[values.length - 1];
  const first = values[0];
  const hidden = tile.hiddenReason || last === null || last === undefined;

  let delta: { text: string; tone: "good" | "bad" | "flat"; dir: "up" | "down" | "flat" } | null = null;
  if (!hidden && first !== null && first !== undefined && last !== null) {
    const diff = last - first;
    const dir = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
    const tone = dir === "flat" ? "flat" : (dir === "up") === tile.upIsGood ? "good" : "bad";
    const pct = first !== 0 ? `${Math.abs((diff / Math.abs(first)) * 100).toFixed(0)}%` : null;
    delta = { text: dir === "flat" ? "No change" : `${tile.format(Math.abs(diff))}${pct ? ` · ${pct}` : ""}`, tone, dir };
  }

  return (
    <div
      className="flex min-w-0 animate-fade-up flex-col rounded-lg border bg-surface p-3.5 sm:p-4"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <p className="truncate text-xs text-muted-foreground" title={tile.note ? `${tile.label} · ${tile.note}` : tile.label}>
        {tile.label}
        {tile.note && <span className="text-muted-foreground/70"> · {tile.note}</span>}
      </p>
      {hidden ? (
        <div className="mt-2 flex flex-1 items-center gap-1.5 text-sm text-muted-foreground">
          <LockIcon className="size-3.5" /> {tile.hiddenReason ?? "Not available"}
        </div>
      ) : (
        <>
          <p className={cn("num mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl", tile.hero && "text-gold-ink")}>
            <CountUp value={last!} format={tile.format} />
          </p>
          <div className="mt-1 flex items-center gap-1 text-[11px]">
            {delta && (
              <span
                className={cn(
                  "num inline-flex items-center gap-0.5",
                  delta.tone === "good" && "text-success",
                  delta.tone === "bad" && "text-danger",
                  delta.tone === "flat" && "text-muted-foreground",
                )}
              >
                {delta.dir === "up" ? <ArrowUpRightIcon className="size-3" /> : delta.dir === "down" ? <ArrowDownRightIcon className="size-3" /> : <MinusIcon className="size-3" />}
                {delta.text}
              </span>
            )}
            <span className="sr-only">over the selected period</span>
          </div>
          <Sparkline series={series} values={values as number[]} format={tile.format} label={tile.label} />
        </>
      )}
    </div>
  );
}

/** Counts up once on first render; respects reduced motion. */
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const done = useRef(false);

  useEffect(() => {
    if (reduce || done.current) {
      setDisplay(value);
      return;
    }
    done.current = true;
    const controls = animate(0, value, { duration: 0.6, ease: "easeOut", onUpdate: setDisplay });
    return () => controls.stop();
  }, [value, reduce]);

  return <>{format(display)}</>;
}

/** Single-series sparkline: 2px line, hover shows the dated value. */
function Sparkline({ series, values, format, label }: { series: KpiPoint[]; values: number[]; format: (n: number) => string; label: string }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 120;
  const H = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (values.length - 1));
    setHover(Math.max(0, Math.min(values.length - 1, i)));
  }

  return (
    <div className="relative mt-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-8 w-full touch-none overflow-visible"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`${label} trend from ${fmtDate(series[0]?.date)} to ${fmtDate(series[series.length - 1]?.date)}`}
      >
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-gold)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--brand-gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />
        <path d={d} fill="none" stroke="var(--brand-gold-soft)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover !== null && (
          <line x1={pts[hover][0]} x2={pts[hover][0]} y1={0} y2={H} stroke="var(--muted-foreground)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="2 2" />
        )}
      </svg>
      {hover !== null && (
        <div
          className="num pointer-events-none absolute -top-8 z-10 -translate-x-1/2 rounded-md border bg-surface-2 px-1.5 py-0.5 text-[11px] whitespace-nowrap"
          style={{ left: `${Math.min(80, Math.max(20, (hover / (values.length - 1)) * 100))}%` }}
        >
          {fmtDate(series[hover].date, "d MMM")} · {format(values[hover])}
        </div>
      )}
    </div>
  );
}
