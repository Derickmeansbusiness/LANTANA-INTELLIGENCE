"use client";

import { useRef } from "react";
import { DownloadIcon, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/components/data-table/csv";
import { formatCompact } from "@/lib/money";
import type { ReportChart as Chart } from "@/server/reports";
import { svgToPng } from "./export-png";

const W = 640;
const LABEL_W = 168;
const VALUE_W = 64;
const PAD = { t: 34, r: 8, b: 22 };

/**
 * Horizontal bars, one row per stage, month or account: long labels stay
 * readable at 375px and in the PNG. Two-series charts pair --chart-in and
 * --chart-out on one axis. The table under each chart holds the exact figures.
 */
export function ReportChart({ chart, fileBase }: { chart: Chart; fileBase: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const pair = chart.kind === "inout";
  const rows = chart.kind === "bars" ? chart.points.map((p) => ({ label: p.label, a: p.value, b: null as number | null })) : chart.points.map((p) => ({ label: p.label, a: p.in, b: p.out as number | null }));
  if (!rows.length) return null;

  const rowH = pair ? 30 : 22;
  const H = PAD.t + rows.length * rowH + PAD.b;
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b ?? 0]));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const x0 = LABEL_W;
  const innerW = W - LABEL_W - VALUE_W - PAD.r;
  const x = (v: number) => x0 + (Math.max(0, v) / top) * innerW;
  const short = (v: number) => formatCompact(v, chart.unit).replace(`${chart.unit} `, "");
  const legend = pair ? [chart.inLabel, chart.outLabel] : [chart.unit];

  const csv = () =>
    downloadCsv(
      `${fileBase}.csv`,
      chart.kind === "bars" ? toCsv(["", chart.unit], chart.points.map((p) => [p.label, p.value])) : toCsv(["", chart.inLabel, chart.outLabel], chart.points.map((p) => [p.label, p.in, p.out])),
    );

  return (
    <figure className="min-w-0">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${chart.title}. Exact figures are in the table below.`}>
        <text x={0} y={14} className="fill-foreground text-[12px] font-medium">
          {chart.title}
        </text>
        {legend.map((l, i) => (
          <g key={l} transform={`translate(${W - PAD.r - (legend.length - i) * 96}, 6)`}>
            <rect width={10} height={10} rx={2} fill={i === 0 ? "var(--chart-in)" : "var(--chart-out)"} />
            <text x={14} y={9} className="fill-muted-foreground text-[10px]">
              {l}
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={PAD.t - 4} y2={H - PAD.b} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={x(t)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {short(t)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = PAD.t + i * rowH;
          const barH = pair ? 10 : 14;
          return (
            <g key={`${r.label}-${i}`}>
              <text x={LABEL_W - 8} y={y + rowH / 2 + 3} textAnchor="end" className="fill-foreground text-[11px]">
                {r.label.length > 26 ? `${r.label.slice(0, 25)}…` : r.label}
              </text>
              <HBar x0={x0} x1={x(r.a)} y={y + (pair ? 4 : (rowH - barH) / 2)} h={barH} fill="var(--chart-in)" />
              <text x={x(r.a) + 4} y={y + (pair ? 4 : (rowH - barH) / 2) + barH - 2} className="fill-muted-foreground text-[10px]">
                {short(r.a)}
              </text>
              {r.b != null && (
                <>
                  <HBar x0={x0} x1={x(r.b)} y={y + 16} h={barH} fill="var(--chart-out)" />
                  <text x={x(r.b) + 4} y={y + 16 + barH - 2} className="fill-muted-foreground text-[10px]">
                    {short(r.b)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => ref.current && svgToPng(ref.current, `${fileBase}.png`)}>
          <ImageIcon /> PNG
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={csv}>
          <DownloadIcon /> CSV
        </Button>
      </figcaption>
    </figure>
  );
}

/** Bar with a rounded end, square at the baseline. */
function HBar({ x0, x1, y, h, fill }: { x0: number; x1: number; y: number; h: number; fill: string }) {
  const w = x1 - x0;
  if (w < 0.5) return null;
  const r = Math.min(3, w, h / 2);
  return <path d={`M${x0},${y} H${x1 - r} Q${x1},${y} ${x1},${y + r} V${y + h - r} Q${x1},${y + h} ${x1 - r},${y + h} H${x0} Z`} fill={fill} />;
}

function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
