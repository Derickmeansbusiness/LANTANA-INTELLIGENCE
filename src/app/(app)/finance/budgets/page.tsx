import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, todayDubai } from "@/lib/dates";
import { budgetVsActual } from "@/server/finance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BudgetTable } from "@/components/finance/budget-table";

export const metadata: Metadata = { title: "Budgets · Finance" };

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export default async function BudgetsPage({ searchParams }: PageProps<"/finance/budgets">) {
  const sp = await searchParams;
  const current = `${todayDubai().slice(0, 7)}-01`;
  const month = typeof sp.month === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(sp.month) ? `${sp.month}-01` : current;
  const db = await createClient();
  const { lines, missingFx } = await budgetVsActual(db, month);
  const nav = (by: number) => `/finance/budgets?month=${shiftMonth(month, by).slice(0, 7)}`;

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>Budget vs actual</CardTitle>
          <CardDescription>Set a monthly budget per account; actuals come from the ledger in AED. Click a budget to change it.</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" asChild>
            <Link href={nav(-1)} aria-label="Previous month">
              <ChevronLeftIcon />
            </Link>
          </Button>
          <span className="num w-24 text-center text-sm font-medium">{fmtDate(month, "MMM yyyy")}</span>
          <Button variant="outline" size="icon-sm" asChild>
            <Link href={nav(1)} aria-label="Next month">
              <ChevronRightIcon />
            </Link>
          </Button>
          {month !== current && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/finance/budgets">This month</Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {missingFx > 0 && <p className="mb-3 text-sm text-warning">{missingFx} transaction(s) this month have no AED rate and are left out.</p>}
        <BudgetTable lines={lines} month={month} />
      </CardContent>
    </Card>
  );
}
