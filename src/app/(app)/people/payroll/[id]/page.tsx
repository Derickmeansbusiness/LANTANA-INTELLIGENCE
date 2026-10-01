import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtDubai } from "@/lib/dates";
import { label } from "@/lib/schemas/common";
import { getSession } from "@/server/session";
import { getPayrollRun } from "@/server/people";
import { bankAccountOptions, listAccounts } from "@/server/finance";
import { PayrollLines, RunActions } from "@/components/people/payroll-panels";
import { payrollStatusVariant, wpsVariant } from "@/components/people/format";

export const metadata: Metadata = { title: "Payroll run" };

export default async function PayrollRunPage({ params }: PageProps<"/people/payroll/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await getSession();
  if (!session.isPrincipal) notFound();
  const db = await createClient();
  const detail = await getPayrollRun(db, id);
  if (!detail) notFound();
  const { run, lines } = detail;
  const [banks, accounts] = await Promise.all([bankAccountOptions(db), listAccounts(db)]);
  const salaryAccounts = accounts.filter((a) => a.type === "expense").sort((a, b) => Number(/salar|payroll|wage/i.test(b.label)) - Number(/salar|payroll|wage/i.test(a.label)));

  return (
    <div>
      <Link href="/people/payroll" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-3.5" /> Payroll
      </Link>
      <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-2xl">Payroll · {fmtDate(run.period, "MMMM yyyy")}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={payrollStatusVariant(run.status)}>{label(run.status)}</Badge>
            <Badge variant={wpsVariant(run.wps_status)}>WPS: {label(run.wps_status)}</Badge>
            {run.is_demo && <Badge variant="outline">Demo</Badge>}
            {run.approver && run.approved_at && <span>Approved by {run.approver.full_name}, {fmtDubai(run.approved_at)}</span>}
            {run.paid_at && <span>· paid {fmtDate(run.paid_at)}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RunActions
            runId={run.id}
            status={run.status}
            wpsStatus={run.wps_status}
            wpsReference={run.wps_reference}
            options={{ banks, salaryAccounts, payDate: run.pay_date ?? "" }}
          />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <PayrollLines lines={lines} currency={run.currency} editable={run.status === "draft"} />
          {run.wps_note && <p className="mt-4 text-sm text-muted-foreground">WPS note: {run.wps_note}</p>}
          <p className="mt-4 text-xs text-muted-foreground">
            Pro rata by calendar days for anyone who joined or left this month. Check the WPS file layout with your bank or exchange house before the first submission.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
