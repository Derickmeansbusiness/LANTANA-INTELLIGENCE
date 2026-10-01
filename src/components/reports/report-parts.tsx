"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArchiveIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { downloadCsv, toCsv } from "@/components/data-table/csv";
import { cn } from "@/lib/utils";
import type { ReportTable as Table } from "@/server/reports";
import { saveReportToVaultAction } from "@/server/actions/reports";

export function ReportTable({ table, fileBase }: { table: Table; fileBase: string }) {
  return (
    <div className="min-w-0">
      {table.caption && <h4 className="mb-2 text-sm font-medium">{table.caption}</h4>}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted-foreground">
            <tr>
              {table.head.map((h, i) => (
                <th key={i} scope="col" className={cn("px-3 py-2 font-medium whitespace-nowrap", table.align?.[i] === "right" && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={cn("px-3 py-2 align-top", table.align?.[j] === "right" && "num text-right whitespace-nowrap", j === 0 && "font-medium")}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-1 flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => downloadCsv(`${fileBase}.csv`, toCsv(table.head, table.rows))}>
          <DownloadIcon /> CSV
        </Button>
      </div>
    </div>
  );
}

type Query = { pack?: string; report?: string; schedule?: string; period?: string; sections?: string };

export function SaveToVaultButton({ query, canSave }: { query: Query; canSave: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!canSave) return null;
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await saveReportToVaultAction(query);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Saved to the vault", { action: { label: "Open", onClick: () => router.push(`/documents/${r.data.documentId}`) } });
          router.refresh();
        })
      }
    >
      <ArchiveIcon /> {pending ? "Saving…" : "Save to vault"}
    </Button>
  );
}

export function PeriodPicker({ value, periods, query }: { value: string; periods: [string, string][]; query: Query }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Period</span>
      <NativeSelect
        aria-label="Report period"
        value={value}
        onChange={(e) => {
          const p = new URLSearchParams(Object.entries({ ...query, period: e.target.value }).filter(([, v]) => v) as [string, string][]);
          router.push(`/reports/view?${p}`);
        }}
      >
        {periods.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

export function PdfLink({ query }: { query: Query }) {
  const p = new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][]);
  return (
    <Button asChild>
      <Link href={`/reports/pdf?${p}`} prefetch={false}>
        <DownloadIcon /> Download PDF
      </Link>
    </Button>
  );
}
