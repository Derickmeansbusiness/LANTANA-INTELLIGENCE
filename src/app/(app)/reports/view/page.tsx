import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, LockIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { buildReport, resolveSpec } from "@/server/reports";
import { PERIODS, SECTIONS } from "@/lib/reports";
import { fmtDate } from "@/lib/dates";
import { safeFileName } from "@/lib/schemas/documents";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportChart } from "@/components/reports/report-chart";
import { PdfLink, PeriodPicker, ReportTable, SaveToVaultButton } from "@/components/reports/report-parts";

export const metadata: Metadata = { title: "Report" };

export default async function ReportViewPage(props: PageProps<"/reports/view">) {
  const session = await getSession();
  if (!session.isManagerPlus) notFound();
  const sp = await props.searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const query = { pack: one("pack"), report: one("report"), schedule: one("schedule"), period: one("period"), sections: one("sections") };
  const db = await createClient();
  const spec = await resolveSpec(db, query);
  if (!spec) notFound();
  const report = await buildReport(db, session, spec);
  const base = safeFileName(`${report.name} ${report.from} ${report.to}`).toLowerCase();
  const custom = !spec.pack && !spec.reportId;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/reports" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Reports
      </Link>
      <PageHeader
        title={report.name}
        description={
          <span className="num">
            {report.periodLabel}: {fmtDate(report.from)} to {fmtDate(report.to)} · built {report.generatedAt} for {report.preparedFor}
          </span>
        }
        actions={
          <>
            <PeriodPicker value={report.period} periods={Object.entries(PERIODS)} query={query} />
            <SaveToVaultButton query={query} canSave={!custom} />
            <PdfLink query={query} />
          </>
        }
      />
      {report.omitted.length > 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-md border bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
          <LockIcon className="mt-0.5 size-4 shrink-0" />
          {report.omitted.map((o) => `${SECTIONS[o.key].label}: ${o.reason}`).join(" ")}
        </p>
      )}
      {session.isPrincipal && report.sections.some((s) => s.key === "cash") && (
        <p className="mb-4 text-xs text-muted-foreground">Cash and runway appear here and in the PDF download only. Vault copies leave them out, because managers can open the vault.</p>
      )}
      <div className="space-y-6">
        {report.sections.map((s) => (
          <Card key={s.key} id={s.key}>
            <CardHeader>
              <CardTitle>{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {s.stats.length > 0 && (
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {s.stats.map((x) => (
                    <div key={x.label} className="min-w-0 rounded-md border px-3 py-2">
                      <dt className="text-xs text-muted-foreground">{x.label}</dt>
                      <dd className="num mt-0.5 font-medium break-words">{x.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {s.chart && <ReportChart chart={s.chart} fileBase={`${base}-${s.key}-chart`} />}
              {s.tables.map((t, i) => (
                <ReportTable key={i} table={t} fileBase={`${base}-${s.key}${s.tables.length > 1 ? `-${i + 1}` : ""}`} />
              ))}
              {s.notes.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {s.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
