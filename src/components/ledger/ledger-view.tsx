"use client";

import { useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { FileDownIcon, PlusIcon, ShieldAlertIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DataTable } from "@/components/data-table/data-table";
import type { SavedView } from "@/components/data-table/types";
import { PageHeader } from "@/components/page-header";
import { fmtDate, fmtDubai } from "@/lib/dates";
import { INTRO_CHANNELS, label } from "@/lib/schemas/common";
import type { ChainStatus, LedgerRow } from "@/server/ledger";
import { IntroductionDialog } from "./introduction-dialog";

type Opt = { value: string; label: string };

export function LedgerView({
  rows,
  views,
  chain,
  deal,
  options,
  canLog,
}: {
  rows: LedgerRow[];
  views: SavedView[];
  chain: { real: ChainStatus; demo: ChainStatus } | null;
  deal: { id: string; name: string } | null;
  options: { orgs: Opt[]; contacts: (Opt & { orgId: string | null })[]; deals: Opt[] };
  canLog: boolean;
}) {
  const [logging, setLogging] = useState(false);
  const [correcting, setCorrecting] = useState<{ id: string; seq: number; summary: string } | undefined>();

  const columns: ColumnDef<LedgerRow, unknown>[] = [
    { accessorKey: "seq", header: "#", meta: { label: "#", className: "num w-12" }, enableHiding: false },
    { accessorKey: "introduced_on", header: "Date", meta: { label: "Date" }, cell: ({ getValue }) => <span className="num whitespace-nowrap">{fmtDate(getValue() as string)}</span> },
    {
      id: "parties",
      accessorFn: (r) => `${r.party_a} ↔ ${r.party_b}`,
      header: "Parties",
      meta: { label: "Parties", className: "min-w-52" },
      cell: ({ row }) => (
        <span>
          {row.original.party_a}
          {row.original.party_a_contact && <span className="text-muted-foreground"> ({row.original.party_a_contact})</span>}
          <span className="text-muted-foreground"> ↔ </span>
          {row.original.party_b}
          {row.original.party_b_contact && <span className="text-muted-foreground"> ({row.original.party_b_contact})</span>}
        </span>
      ),
    },
    { accessorKey: "channel", header: "Channel", meta: { label: "Channel", csv: (r) => label(r.channel) }, cell: ({ getValue }) => label(String(getValue())) },
    {
      accessorKey: "deal_name",
      header: "Deal",
      meta: { label: "Deal" },
      cell: ({ row }) => (row.original.deal_id ? <Link href={`/deals/${row.original.deal_id}`} className="hover:text-gold-ink">{row.original.deal_name}</Link> : "—"),
    },
    {
      accessorKey: "summary",
      header: "Introduction",
      meta: { label: "Introduction", className: "min-w-72 max-w-md" },
      cell: ({ row }) => (
        <span>
          {row.original.corrects_seq && <Badge variant="warning" className="mr-1.5">Corrects #{row.original.corrects_seq}</Badge>}
          {row.original.is_demo && <Badge variant="outline" className="mr-1.5">Demo</Badge>}
          {row.original.summary}
        </span>
      ),
    },
    {
      accessorKey: "recorded_at",
      header: "Recorded",
      meta: { label: "Recorded at", csv: (r) => r.recorded_at },
      cell: ({ row }) => (
        <span className="num text-xs whitespace-nowrap text-muted-foreground">
          {fmtDubai(row.original.recorded_at, "d MMM yyyy, HH:mm")}
          <br />
          {row.original.recorded_by ?? "System"}
        </span>
      ),
    },
    {
      accessorKey: "row_hash",
      header: "Hash",
      meta: { label: "Row hash (SHA-256)" },
      cell: ({ getValue }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="num font-mono text-[11px] text-muted-foreground">
              {String(getValue()).slice(0, 10)}…
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-none font-mono text-[11px]">{String(getValue())}</TooltipContent>
        </Tooltip>
      ),
    },
    ...(canLog
      ? [
          {
            id: "actions",
            header: "",
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }: { row: { original: LedgerRow } }) => (
              <Button variant="ghost" size="sm" className="h-7" onClick={() => setCorrecting({ id: row.original.id, seq: row.original.seq, summary: row.original.summary })}>
                Correct
              </Button>
            ),
          } satisfies ColumnDef<LedgerRow, unknown>,
        ]
      : []),
  ];

  const status = chain && (rows.some((r) => !r.is_demo) || !rows.length ? chain.real : chain.demo);

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <PageHeader
        title="Introductions ledger"
        description="Every time Lantana puts two parties in touch. Append-only and hash-chained: Lantana's evidence in a circumvention dispute."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href={`/deals/ledger/export${deal ? `?deal=${deal.id}` : ""}`} download>
                <FileDownIcon /> Export PDF
              </a>
            </Button>
            {canLog && (
              <Button size="sm" onClick={() => setLogging(true)}>
                <PlusIcon /> Log introduction
              </Button>
            )}
          </>
        }
      />

      {status ? (
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm ${status.ok ? "border-success/40 bg-success/5" : "border-danger/50 bg-danger/10"}`} role="status">
          {status.ok ? <ShieldCheckIcon className="size-4 text-success" /> : <ShieldAlertIcon className="size-4 text-danger" />}
          <span>
            {status.ok ? "Chain verified" : `Chain broken at entry #${status.firstBroken}. Someone changed the database outside the app.`} · {status.rows}{" "}
            {status.rows === 1 ? "entry" : "entries"} re-hashed just now
          </span>
          {status.head && (
            <span className="num min-w-0 truncate font-mono text-xs text-muted-foreground" title={status.head}>
              head {status.head}
            </span>
          )}
        </div>
      ) : (
        <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">Chain verification is available to managers and principals.</p>
      )}

      {deal && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Showing</span>
          <Badge variant="gold">{deal.name}</Badge>
          <Link href="/deals/ledger" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <XIcon className="size-3" /> Show all
          </Link>
        </div>
      )}

      <DataTable
        module="ledger"
        columns={columns}
        data={rows}
        views={views}
        csvName="lantana-introductions"
        searchPlaceholder="Search parties, deals, summaries…"
        defaultSorting={[{ id: "seq", desc: true }]}
        defaultHidden={["row_hash"]}
        facets={[{ columnId: "channel", label: "Channels", options: INTRO_CHANNELS.map((c) => ({ value: c, label: label(c) })) }]}
        empty={canLog ? "No introductions yet. Log the first one: date, both parties, how it happened." : "No introductions on your deals yet."}
      />

      {canLog && <IntroductionDialog open={logging} onOpenChange={setLogging} dealId={deal?.id} {...options} />}
      {canLog && correcting && (
        <IntroductionDialog key={correcting.id} open onOpenChange={(o) => !o && setCorrecting(undefined)} corrects={correcting} {...options} />
      )}
    </div>
  );
}
