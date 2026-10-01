"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { FileUpIcon, ListFilterIcon, PlusIcon, WandSparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { DataTable } from "@/components/data-table/data-table";
import type { SavedView } from "@/components/data-table/types";
import { fmtDate } from "@/lib/dates";
import { formatMoney, toMajor } from "@/lib/money";
import type { TxnRow } from "@/server/finance";
import { categoriseUncategorisedAction, updateTransactionAction } from "@/server/actions/finance";
import { ImportDialog } from "./import-dialog";
import { RulesDialog, type Rule } from "./rules-dialog";
import { TransactionDialog } from "./transaction-dialog";

type Opt = { value: string; label: string };
type Options = { accounts: (Opt & { type: string })[]; banks: (Opt & { currency: string })[]; currencies: Opt[]; orgs: Opt[] };

const SOURCE_LABEL: Record<string, string> = { manual: "Set by hand", rule: "From a rule", history: "Like a past line", agent: "Suggested by Ask Lantana" };

function CategoryCell({ row, accounts }: { row: TxnRow; accounts: Opt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (row.is_payroll) return <span className="text-muted-foreground">{row.account ?? "Payroll"}</span>;
  return (
    <div className="min-w-48">
      <NativeSelect
        aria-label={`Category for ${row.description}`}
        value={row.account_id ?? ""}
        disabled={pending}
        className="h-8"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) =>
          start(async () => {
            const r = await updateTransactionAction(row.id, { account_id: e.target.value });
            if (!r.ok) return void toast.error(r.error);
            router.refresh();
          })
        }
      >
        <option value="">Not categorised</option>
        {accounts.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </NativeSelect>
      {row.account_id && row.category_source !== "manual" && <p className="mt-0.5 text-[11px] text-muted-foreground">{SOURCE_LABEL[row.category_source]}</p>}
    </div>
  );
}

export function LedgerView({ rows, views, options, rules, principal }: { rows: TxnRow[]; views: SavedView[]; options: Options; rules: Rule[]; principal: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"new" | "import" | "rules" | null>(null);
  const [pending, start] = useTransition();
  const uncategorised = rows.filter((r) => !r.account_id && !r.is_transfer).length;

  const columns: ColumnDef<TxnRow, unknown>[] = [
    {
      accessorKey: "txn_date",
      header: "Date",
      meta: { label: "Date" },
      cell: ({ getValue }) => <span className="num whitespace-nowrap">{fmtDate(String(getValue()))}</span>,
    },
    {
      accessorKey: "description",
      header: "Description",
      enableHiding: false,
      meta: { label: "Description", className: "min-w-64" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="font-medium">{row.original.description}</span>
          {row.original.is_demo && <Badge variant="outline" className="ml-2 align-middle">Demo</Badge>}
          {row.original.is_payroll && <Badge variant="gold" className="ml-2 align-middle">Payroll</Badge>}
          {row.original.is_transfer && <Badge variant="outline" className="ml-2 align-middle">Transfer</Badge>}
          <div className="mt-0.5 text-xs text-muted-foreground">
            {[row.original.counterparty, row.original.deal, row.original.linked, row.original.reference].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
      ),
    },
    {
      id: "amount",
      accessorFn: (r) => toMajor(r.amount_minor, r.currency),
      header: "Amount",
      meta: { label: "Amount", className: "text-right", csv: (r) => `${toMajor(r.amount_minor, r.currency)} ${r.currency}` },
      cell: ({ row }) => (
        <span className={`num whitespace-nowrap ${row.original.amount_minor > 0 ? "text-success" : ""}`}>
          {formatMoney(toMajor(row.original.amount_minor, row.original.currency), row.original.currency)}
        </span>
      ),
    },
    {
      id: "category",
      accessorFn: (r) => r.account ?? "Not categorised",
      header: "Category",
      filterFn: (row, _id, value: string) => !value || (row.original.account_id ?? "none") === value,
      meta: { label: "Category", csv: (r) => r.account ?? "" },
      cell: ({ row }) => <CategoryCell row={row.original} accounts={options.accounts} />,
    },
    ...(principal
      ? [{ accessorKey: "bank", header: "Bank", meta: { label: "Bank account" }, cell: ({ getValue }) => (getValue() as string) ?? "—" } as ColumnDef<TxnRow, unknown>]
      : []),
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {uncategorised > 0 ? (
            <>
              <span className="num font-medium text-warning">{uncategorised}</span> line{uncategorised === 1 ? "" : "s"} not categorised yet.
            </>
          ) : (
            "Every line has a category."
          )}
          {!principal && " Payroll lines are visible to principals only."}
        </p>
        <div className="flex flex-wrap gap-2">
          {uncategorised > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await categoriseUncategorisedAction();
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(r.data.updated ? `Categorised ${r.data.updated} line${r.data.updated === 1 ? "" : "s"} from rules and history` : "No rule or past line matched. Set them by hand.");
                  router.refresh();
                })
              }
            >
              <WandSparklesIcon /> Apply rules
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setDialog("rules")}>
            <ListFilterIcon /> Rules
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialog("import")}>
            <FileUpIcon /> Import statement
          </Button>
          <Button size="sm" onClick={() => setDialog("new")}>
            <PlusIcon /> New transaction
          </Button>
        </div>
      </div>
      <DataTable
        module="finance_ledger"
        columns={columns}
        data={rows}
        views={views}
        csvName="lantana-ledger"
        searchPlaceholder="Search descriptions, counterparties, references…"
        defaultSorting={[{ id: "txn_date", desc: true }]}
        facets={[{ columnId: "category", label: "Categories", options: [{ value: "none", label: "Not categorised" }, ...options.accounts] }]}
        empty="No transactions yet. Import a bank statement to start."
      />
      <TransactionDialog open={dialog === "new"} onOpenChange={(o) => setDialog(o ? "new" : null)} options={options} />
      <ImportDialog open={dialog === "import"} onOpenChange={(o) => setDialog(o ? "import" : null)} options={options} />
      <RulesDialog open={dialog === "rules"} onOpenChange={(o) => setDialog(o ? "rules" : null)} rules={rules} accounts={options.accounts} />
    </>
  );
}
