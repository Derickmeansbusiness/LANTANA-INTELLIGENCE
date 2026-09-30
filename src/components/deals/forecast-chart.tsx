"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact } from "@/lib/money";
import { fmtDate } from "@/lib/dates";

type Month = { month: string; weighted: number; total: number; deals: number };

/**
 * Weighted pipeline by expected close month: one series, one hue, rounded
 * data ends, hover tooltip with the unweighted value. A table sits below for
 * anyone who can't or won't read the chart.
 */
export function ForecastChart({ months, undated, overdue }: { months: Month[]; undated: number; overdue: number }) {
  const total = months.reduce((a, m) => a + m.weighted, 0);
  return (
    <div className="space-y-4">
      <div className="num flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          Next 12 months <span className="font-semibold text-gold-ink">{formatCompact(total, "USD")}</span> weighted
        </span>
        {overdue > 0 && (
          <span className="text-warning">{formatCompact(overdue, "USD")} past its expected close date: re-date those deals</span>
        )}
        {undated > 0 && <span className="text-muted-foreground">{formatCompact(undated, "USD")} has no expected close date</span>}
      </div>
      <div className="h-72 w-full" role="img" aria-label="Weighted pipeline by expected close month">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="month"
              tickFormatter={(m: string) => fmtDate(`${m}-01`, "MMM")}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => formatCompact(v, "USD")}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as Month | undefined;
                if (!active || !p) return null;
                return (
                  <div className="num rounded-md border bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg">
                    <p className="font-medium">{fmtDate(`${p.month}-01`, "MMMM yyyy")}</p>
                    <p>Weighted {formatCompact(p.weighted, "USD")}</p>
                    <p className="text-muted-foreground">
                      Unweighted {formatCompact(p.total, "USD")} · {p.deals} {p.deals === 1 ? "deal" : "deals"}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="weighted" fill="var(--brand-gold-soft)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Show as a table</summary>
        <table className="num mt-2 w-full max-w-md text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-normal">Month</th>
              <th className="py-1 text-right font-normal">Weighted</th>
              <th className="py-1 text-right font-normal">Unweighted</th>
              <th className="py-1 text-right font-normal">Deals</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-t">
                <td className="py-1">{fmtDate(`${m.month}-01`, "MMM yyyy")}</td>
                <td className="py-1 text-right">{formatCompact(m.weighted, "USD")}</td>
                <td className="py-1 text-right">{formatCompact(m.total, "USD")}</td>
                <td className="py-1 text-right">{m.deals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
