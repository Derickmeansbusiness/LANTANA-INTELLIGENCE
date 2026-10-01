"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { BudgetLine } from "@/server/finance";
import { rollBudgetForwardAction, setBudgetAction } from "@/server/actions/finance";

const fmt = (n: number) => formatMoney(n, "AED").replace("AED ", "");

function BudgetInput({ line, month }: { line: BudgetLine; month: string }) {
  const router = useRouter();
  const initial = line.budget == null ? "" : String(Math.round(line.budget * 100) / 100);
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const save = () => {
    if (v === initial) return;
    start(async () => {
      const r = await setBudgetAction({ account_id: line.account_id, month, amount: v === "" ? "0" : v });
      if (!r.ok) {
        setV(initial);
        return void toast.error(r.error);
      }
      router.refresh();
    });
  };
  return (
    <Input
      aria-label={`Budget for ${line.name}`}
      inputMode="decimal"
      value={v}
      placeholder="—"
      disabled={pending}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className="num h-8 w-28 text-right"
    />
  );
}

export function BudgetTable({ lines, month }: { lines: BudgetLine[]; month: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const groups = [
    { title: "Income", rows: lines.filter((l) => l.type === "income") },
    { title: "Costs", rows: lines.filter((l) => l.type === "expense") },
  ];
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await rollBudgetForwardAction(month);
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.data.created ? `Copied ${r.data.created} budget line${r.data.created === 1 ? "" : "s"} into the next three months` : "The next three months already have budgets.");
              router.refresh();
            })
          }
        >
          <CopyIcon /> Copy to next 3 months
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Budget against actual by account</caption>
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th scope="col" className="py-2 text-left font-normal">Account</th>
              <th scope="col" className="py-2 text-right font-normal">Budget (AED)</th>
              <th scope="col" className="py-2 text-right font-normal">Actual (AED)</th>
              <th scope="col" className="py-2 text-right font-normal">Variance</th>
              <th scope="col" className="w-32 py-2 pl-3 text-left font-normal">Used</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.title}>
              <tr>
                <th colSpan={5} scope="rowgroup" className="pt-4 pb-1 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {g.title}
                </th>
              </tr>
              {g.rows.map((l) => {
                const pct = l.budget ? Math.min(150, (l.actual / l.budget) * 100) : null;
                const over = l.variance != null && l.variance < 0;
                return (
                  <tr key={l.account_id} className="border-b">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                      <span className="num mr-2 text-xs text-muted-foreground">{l.code}</span>
                      {l.name}
                    </th>
                    <td className="py-1.5 text-right">
                      <div className="flex justify-end">
                        <BudgetInput key={`${l.account_id}-${month}-${l.budget}`} line={l} month={month} />
                      </div>
                    </td>
                    <td className="num py-1.5 text-right">{l.actual ? fmt(l.actual) : "—"}</td>
                    <td className={cn("num py-1.5 text-right", over && "text-danger")}>
                      {l.variance == null ? "—" : `${l.variance >= 0 ? "+" : "−"}${fmt(Math.abs(l.variance))}`}
                    </td>
                    <td className="py-1.5 pl-3">
                      {pct == null ? (
                        <span className="text-xs text-muted-foreground">No budget</span>
                      ) : (
                        <span className="flex items-center gap-2" title={`${pct.toFixed(0)}% of budget`}>
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                            <span className={cn("block h-full rounded-full", over ? "bg-danger" : "bg-gold")} style={{ width: `${Math.min(100, pct)}%` }} />
                          </span>
                          <span className="num text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Variance is positive when income beats budget or spending stays under it. Salaries are shown in aggregate.</p>
    </div>
  );
}
