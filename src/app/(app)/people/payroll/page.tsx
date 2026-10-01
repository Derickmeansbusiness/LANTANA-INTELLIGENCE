import type { Metadata } from "next";
import Link from "next/link";
import { LockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, todayDubai } from "@/lib/dates";
import { label } from "@/lib/schemas/common";
import { getSession } from "@/server/session";
import { listPayrollRuns } from "@/server/people";
import { NewRunButton, WpsSettingsForm } from "@/components/people/payroll-panels";
import { payrollStatusVariant, wpsVariant } from "@/components/people/format";

export const metadata: Metadata = { title: "Payroll · People" };

export default async function PayrollPage() {
  const session = await getSession();
  if (!session.isPrincipal) {
    return (
      <p className="flex items-center gap-2 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
        <LockIcon className="size-4" />
        {session.role === "principal" ? "Payroll needs two-step sign-in. Verify with your authenticator app to continue." : "Payroll is visible to principals only."}
      </p>
    );
  }
  const db = await createClient();
  const [runs, { data: company }] = await Promise.all([listPayrollRuns(db), db.from("company").select("mohre_establishment_id, wps_employer_bank_code").maybeSingle()]);
  const live = new Set(runs.filter((r) => r.status !== "void").map((r) => r.period.slice(0, 7)));
  const thisMonth = todayDubai().slice(0, 7);
  const suggested = live.has(thisMonth) ? `${Number(thisMonth.slice(0, 4)) + (thisMonth.endsWith("12") ? 1 : 0)}-${String((Number(thisMonth.slice(5)) % 12) + 1).padStart(2, "0")}` : thisMonth;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Draft → approve → pay → submit the WPS file. Amounts are decrypted only on this page and every view is logged.</p>
        <NewRunButton suggested={suggested} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payroll runs yet.</p>
          ) : (
            <ul className="divide-y">
              {runs.map((r) => (
                <li key={r.id}>
                  <Link href={`/people/payroll/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-gold-ink">
                    <span className="min-w-0">
                      <span className="font-medium">{fmtDate(r.period, "MMMM yyyy")}</span>
                      {r.is_demo && <Badge variant="outline" className="ml-2 align-middle">Demo</Badge>}
                      <span className="block text-xs text-muted-foreground">
                        {r.people} {r.people === 1 ? "person" : "people"}
                        {r.pay_date && ` · pay date ${fmtDate(r.pay_date)}`}
                        {r.wps_reference && ` · ${r.wps_reference}`}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Badge variant={payrollStatusVariant(r.status)}>{label(r.status)}</Badge>
                      <Badge variant={wpsVariant(r.wps_status)}>WPS: {label(r.wps_status)}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>WPS details</CardTitle>
            <CardDescription>Needed to produce the salary information file (SIF). Your bank or exchange house can confirm both numbers.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <WpsSettingsForm initial={{ mohre_establishment_id: company?.mohre_establishment_id ?? "", wps_employer_bank_code: company?.wps_employer_bank_code ?? "" }} />
        </CardContent>
      </Card>
    </div>
  );
}
