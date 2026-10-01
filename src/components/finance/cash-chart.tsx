"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/dates";
import { formatCompact, formatMoney } from "@/lib/money";

type Point = { month: string; inflow: number; outflow: number; closing: number | null };

const W = 640;
const H = 200;
const PAD = { t: 12, r: 8, b: 26, l: 52 };

/**
 * Money in vs money out per month (paired bars, one axis). Closing cash is a
 * different measure, so it sits in its own row of numbers rather than a
 * second y-axis. Hover a month for exact figures; the P&L table is the table view.
 */
export function CashChart({ series }: { series: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!series.length) return <p className="text-sm text-muted-foreground">No bank movements in this period.</p>;
  const max = Math.max(1, ...series.flatMap((p) => [p.inflow, p.outflow]));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const band = innerW / series.length;
  const barW = Math.min(18, (band - 10) / 2);
  const y = (v: number) => PAD.t + innerH - (v / top) * innerH;
  const active = hover == null ? null : series[hover];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: "var(--chart-in)" }} /> Money in
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: "var(--chart-out)" }} /> Money out
        </span>
        <span className="num ml-auto min-h-4 text-foreground">
          {active ? `${fmtDate(active.month, "MMM yyyy")}: in ${formatMoney(active.inflow, "AED")} · out ${formatMoney(active.outflow, "AED")}` : ""}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Money in and money out by month, in AED">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {formatCompact(t, "AED").replace("AED ", "")}
            </text>
          </g>
        ))}
        {series.map((p, i) => {
          const cx = PAD.l + band * i + band / 2;
          return (
            <g key={p.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={PAD.l + band * i} y={PAD.t} width={band} height={innerH} fill={hover === i ? "var(--chart-grid)" : "transparent"} opacity={0.5} />
              <Bar x={cx - barW - 1} w={barW} y0={y(0)} y1={y(p.inflow)} fill="var(--chart-in)" />
              <Bar x={cx + 1} w={barW} y0={y(0)} y1={y(p.outflow)} fill="var(--chart-out)" />
              <text x={cx} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {fmtDate(p.month, "MMM")}
              </text>
            </g>
          );
        })}
      </svg>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
        {series.map((p) => (
          <div key={p.month} className="min-w-0">
            <dt className="text-muted-foreground">Cash end {fmtDate(p.month, "MMM")}</dt>
            <dd className="num truncate font-medium">{p.closing == null ? "—" : formatCompact(p.closing, "AED")}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Bar with a 4px rounded top, square at the baseline. */
function Bar({ x, w, y0, y1, fill }: { x: number; w: number; y0: number; y1: number; fill: string }) {
  const h = Math.max(0, y0 - y1);
  if (h < 0.5) return null;
  const r = Math.min(4, h, w / 2);
  return <path d={`M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`} fill={fill} />;
}

function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
