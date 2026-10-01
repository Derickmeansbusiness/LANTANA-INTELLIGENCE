import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangleIcon, LockIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { financeOverview } from "@/server/finance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CashChart } from "@/components/finance/cash-chart";
import { fmtDate } from "@/lib/dates";
import { formatCompact, formatMoney } from "@/lib/money";
import { AGING_BUCKETS } from "@/lib/finance";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Finance" };

const aed = (n: number) => formatMoney(n, "AED");

export default async function FinanceOverviewPage() {
  const session = await getSession();
  const db = await createClient();
  const o = await financeOverview(db, { principal: session.isPrincipal });
  const ytdNet = o.pnl.totals.net;

  return (
    <div className="space-y-6">
      <section aria-label="Headline figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Income, last 6 months" value={formatCompact(o.pnl.totals.income, "AED")} />
        <Tile label="Costs, last 6 months" value={formatCompact(o.pnl.totals.expense, "AED")} note="payroll included in total" />
        <Tile label="Net result" value={formatCompact(ytdNet, "AED")} tone={ytdNet < 0 ? "bad" : "good"} />
        {o.cash ? (
          <Tile
            label="Cash on hand"
            value={formatCompact(o.cash.now, "AED")}
            note={o.cash.runway == null ? "cash isn't falling" : `≈ ${o.cash.runway.toFixed(1)} months of runway`}
          />
        ) : (
          <Tile label="Cash and runway" locked="Principals only" />
        )}
      </section>

      {o.pnl.missingFx > 0 && (
        <p className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertTriangleIcon className="size-4 shrink-0" />
          {o.pnl.missingFx} transaction{o.pnl.missingFx === 1 ? " has" : "s have"} no AED rate for its date and {o.pnl.missingFx === 1 ? "is" : "are"} left out.{" "}
          <Link href="/finance/fx" className="underline">
            Add rates
          </Link>
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Cash flow</CardTitle>
              <CardDescription>Bank movements by month, all accounts, in AED.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {o.cash ? (
              <CashChart series={o.cash.series} />
            ) : (
              <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <LockIcon className="size-4" /> Bank balances and cash flow are visible to principals only.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Aging</CardTitle>
              <CardDescription>Open invoices and bills by days past due, in AED.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <Aging title="Owed to Lantana" href="/finance/invoices" data={o.receivables} />
            <Aging title="Lantana owes" href="/finance/bills" data={o.payables} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Profit and loss</CardTitle>
            <CardDescription>
              {fmtDate(o.months[0], "MMM yyyy")} to {fmtDate(o.months.at(-1)!, "MMM yyyy")}. Costs are shown as positive amounts. Transfers between Lantana accounts are left out.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Profit and loss by month</caption>
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 text-left font-normal">Account</th>
                {o.months.map((m) => (
                  <th key={m} scope="col" className="px-2 py-2 text-right font-normal">
                    {fmtDate(m, "MMM")}
                  </th>
                ))}
                <th scope="col" className="py-2 pl-2 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              <Section title="Income" />
              {o.pnl.income.map((l) => (
                <Line key={l.key} name={l.name} code={l.code} byMonth={l.byMonth} total={l.total} months={o.months} />
              ))}
              <Line name="Total income" byMonth={o.pnl.incomeByMonth} total={o.pnl.totals.income} months={o.months} strong />
              <Section title="Costs" />
              {o.pnl.expense.map((l) => (
                <Line key={l.key} name={l.name} code={l.code} byMonth={l.byMonth} total={l.total} months={o.months} muted={l.type === "uncategorised"} />
              ))}
              <Line name="Total costs" byMonth={o.pnl.expenseByMonth} total={o.pnl.totals.expense} months={o.months} strong />
              <Line name="Net result" byMonth={o.pnl.netByMonth} total={o.pnl.totals.net} months={o.months} strong signed />
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value, note, tone, locked }: { label: string; value?: string; note?: string; tone?: "good" | "bad"; locked?: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-surface p-3.5 sm:p-4">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      {locked ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <LockIcon className="size-3.5" /> {locked}
        </p>
      ) : (
        <>
          <p className={cn("num mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl", tone === "bad" && "text-danger")}>{value}</p>
          {note && <p className="mt-1 truncate text-[11px] text-muted-foreground">{note}</p>}
        </>
      )}
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <tr>
      <th colSpan={99} scope="rowgroup" className="pt-4 pb-1 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </th>
    </tr>
  );
}

function Line({
  name,
  code,
  byMonth,
  total,
  months,
  strong,
  muted,
  signed,
}: {
  name: string;
  code?: string | null;
  byMonth: Record<string, number>;
  total: number;
  months: string[];
  strong?: boolean;
  muted?: boolean;
  signed?: boolean;
}) {
  const cell = (v: number) => (v === 0 ? "—" : aed(v).replace("AED ", ""));
  return (
    <tr className={cn("border-b last:border-0", strong && "font-medium", muted && "text-muted-foreground")}>
      <th scope="row" className={cn("py-1.5 pr-3 text-left", strong ? "font-medium" : "font-normal")}>
        {code && <span className="num mr-2 text-xs text-muted-foreground">{code}</span>}
        {name}
      </th>
      {months.map((m) => (
        <td key={m} className={cn("num px-2 py-1.5 text-right", signed && (byMonth[m] ?? 0) < 0 && "text-danger")}>
          {cell(byMonth[m] ?? 0)}
        </td>
      ))}
      <td className={cn("num py-1.5 pl-2 text-right", signed && total < 0 && "text-danger")}>{cell(total)}</td>
    </tr>
  );
}

function Aging({ title, href, data }: { title: string; href: string; data: { buckets: Record<string, number>; total: number; count: number; missing: number } }) {
  const max = Math.max(1, ...Object.values(data.buckets));
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <Link href={href} className="text-sm font-medium hover:text-gold-ink">
          {title}
        </Link>
        <span className="num text-sm">{formatMoney(data.total, "AED")}</span>
      </div>
      {data.count === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing open.</p>
      ) : (
        <ul className="space-y-1.5">
          {AGING_BUCKETS.map((b) => (
            <li key={b} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-xs">
              <span className="text-muted-foreground">{b === "current" ? "Not yet due" : `${b} days`}</span>
              <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <span
                  className={cn("block h-full rounded-full", b === "current" ? "bg-muted-foreground/40" : b === "1-30" ? "bg-warning/70" : "bg-danger/80")}
                  style={{ width: `${(data.buckets[b] / max) * 100}%` }}
                />
              </span>
              <span className="num w-20 text-right">{data.buckets[b] ? formatCompact(data.buckets[b], "AED") : "—"}</span>
            </li>
          ))}
        </ul>
      )}
      {data.missing > 0 && <p className="mt-1 text-xs text-warning">{data.missing} item(s) need an FX rate to be counted.</p>}
    </div>
  );
}
