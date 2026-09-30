"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCompact } from "@/lib/money";
import type { CountryRow } from "@/server/command-center";
import { MAP_CONTEXT, MAP_COUNTRIES, MAP_VIEWBOX } from "./map-data";

/**
 * Africa + GCC with deals plotted by country. Bubble AREA is proportional to
 * open value (radius = sqrt), one hue. Hover or focus a bubble for details.
 */
export function GeoMap({ rows }: { rows: CountryRow[] }) {
  const [active, setActive] = useState<string | null>(null);
  const byCode = new Map(rows.map((r) => [r.country, r]));
  const max = Math.max(...rows.map((r) => r.value_usd), 1);
  const radius = (v: number) => 5 + Math.sqrt(v / max) * 22;
  const activeRow = active ? byCode.get(active) : null;
  const activeShape = active ? MAP_COUNTRIES.find((c) => c.code === active) : null;
  const plotted = MAP_COUNTRIES.filter((c) => byCode.has(c.code)).sort((a, b) => byCode.get(b.code)!.value_usd - byCode.get(a.code)!.value_usd);

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
      <div className="relative">
        <svg viewBox={MAP_VIEWBOX} className="h-auto w-full" role="img" aria-label="Map of Africa and the GCC with deals by country">
          {MAP_CONTEXT.map((d, i) => (
            <path key={i} d={d} fill="var(--map-land)" opacity={0.45} stroke="none" />
          ))}
          {MAP_COUNTRIES.filter((c) => c.d).map((c) => (
            <path
              key={c.code}
              d={c.d}
              fill={byCode.has(c.code) ? "var(--gold-wash)" : "var(--map-land)"}
              stroke={c.code === active ? "var(--brand-gold)" : "var(--map-land-stroke)"}
              strokeWidth={c.code === active ? 1.2 : 0.5}
            />
          ))}
          {plotted.map((c) => {
            const row = byCode.get(c.code)!;
            const r = radius(row.value_usd);
            return (
              <g
                key={c.code}
                tabIndex={0}
                role="button"
                aria-label={`${row.country_name}: ${row.deal_count} deals, ${formatCompact(row.value_usd, "USD")}`}
                onPointerEnter={() => setActive(c.code)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(c.code)}
                onBlur={() => setActive(null)}
                className="cursor-pointer outline-none"
              >
                <circle cx={c.cx} cy={c.cy} r={r + 8} fill="transparent" />
                <circle cx={c.cx} cy={c.cy} r={r} fill="var(--brand-gold)" fillOpacity={c.code === active ? 0.55 : 0.32} stroke="var(--brand-gold)" strokeWidth={1.5} />
                <circle cx={c.cx} cy={c.cy} r={2} fill="var(--brand-gold)" />
              </g>
            );
          })}
        </svg>
        {activeRow && activeShape && (
          <div
            className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-full rounded-md border bg-surface-2 p-2.5 text-xs shadow-lg"
            style={{ left: `${(activeShape.cx / 560) * 100}%`, top: `calc(${(activeShape.cy / 600) * 100}% - 14px)` }}
          >
            <p className="font-medium">{activeRow.country_name}</p>
            <p className="num text-muted-foreground">
              {activeRow.deal_count} {activeRow.deal_count === 1 ? "deal" : "deals"} · {formatCompact(activeRow.value_usd, "USD")}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {activeRow.deals.map((d) => (
                <li key={d.id} className="truncate">
                  {d.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <ul className="space-y-1 self-center text-sm" aria-label="Deals by country">
        {rows.length === 0 && <li className="text-muted-foreground">No deals with a country yet.</li>}
        {[...rows]
          .sort((a, b) => b.value_usd - a.value_usd)
          .map((r) => (
            <li key={r.country}>
              <Link
                href={`?record=deal:${r.deals[0]?.id}`}
                scroll={false}
                onPointerEnter={() => setActive(r.country)}
                onPointerLeave={() => setActive(null)}
                className="flex items-baseline justify-between gap-2 rounded-sm px-1 py-0.5 hover:bg-surface-2"
              >
                <span className="truncate">{r.country_name}</span>
                <span className="num shrink-0 text-xs text-muted-foreground">
                  {formatCompact(r.value_usd, "USD")} · {r.deal_count}
                </span>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
