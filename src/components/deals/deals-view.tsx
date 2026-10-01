"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpenCheckIcon, ChartColumnIcon, KanbanSquareIcon, PlusIcon, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import type { SavedView } from "@/components/data-table/types";
import type { DealRow } from "@/server/deals";
import { DealBoard } from "./deal-board";
import { DealTable } from "./deal-table";
import { ForecastChart } from "./forecast-chart";
import { DealFormDialog, type DealFormOptions } from "./deal-form-dialog";

type Tab = "board" | "table" | "forecast";

export function DealsView({
  deals,
  options,
  views,
  forecast,
  canCreate,
  userId,
  isStaff,
}: {
  deals: DealRow[];
  options: DealFormOptions & { stages: (DealFormOptions["stages"][number] & { is_won: boolean })[] };
  views: SavedView[];
  forecast: { months: { month: string; weighted: number; total: number; deals: number }[]; undated: number; overdue: number };
  canCreate: boolean;
  userId: string;
  isStaff: boolean;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (["board", "table", "forecast"].includes(sp.get("view") ?? "") ? sp.get("view") : "board") as Tab;
  const [creating, setCreating] = useState(false);

  function setTab(t: string) {
    const p = new URLSearchParams(sp.toString());
    if (t === "board") p.delete("view");
    else p.set("view", t);
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Deals"
        description={isStaff ? "The deals you're assigned to." : "Every mandate and opportunity, from first lead to close."}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/deals/ledger">
                <BookOpenCheckIcon /> Introductions ledger
              </Link>
            </Button>
            {canCreate && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <PlusIcon /> New deal
              </Button>
            )}
          </>
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList aria-label="Deal views">
          <TabsTrigger panelless value="board">
            <KanbanSquareIcon /> Board
          </TabsTrigger>
          <TabsTrigger panelless value="table">
            <TableIcon /> Table
          </TabsTrigger>
          <TabsTrigger panelless value="forecast">
            <ChartColumnIcon /> Forecast
          </TabsTrigger>
        </TabsList>
        {deals.length === 0 && tab !== "table" ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-display text-lg">No deals yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {canCreate ? "Start with the opportunity you're working on today. Only the name and sector are required." : "When a principal assigns you to a deal it will appear here."}
            </p>
            {canCreate && (
              <Button className="mt-4" onClick={() => setCreating(true)}>
                <PlusIcon /> New deal
              </Button>
            )}
          </div>
        ) : tab === "board" ? (
          <DealBoard deals={deals} stages={options.stages} />
        ) : tab === "table" ? (
          <DealTable deals={deals} views={views} stages={options.stages} countries={options.countries} owners={options.people} />
        ) : (
          <div className="rounded-lg border bg-surface p-4 sm:p-5">
            <h2 className="text-sm font-medium">Weighted pipeline forecast</h2>
            <p className="mb-4 text-xs text-muted-foreground">Deal value × probability, grouped by expected close month. Converted to USD at stored rates.</p>
            <ForecastChart {...forecast} />
          </div>
        )}
      </Tabs>
      {canCreate && <DealFormDialog open={creating} onOpenChange={setCreating} options={options} defaultOwnerId={userId} />}
    </div>
  );
}
