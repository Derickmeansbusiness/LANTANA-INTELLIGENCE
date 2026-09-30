import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { fmtDubai } from "@/lib/dates";
import { getSession } from "@/server/session";
import { WipeDemo } from "./wipe-demo";
import { RunAlerts } from "./run-alerts";

export const metadata: Metadata = { title: "Settings" };

const ROLE_TONE = { principal: "gold", manager: "info", staff: "default", external: "outline" } as const;

export default async function SettingsPage() {
  const session = await getSession();
  const supabase = await createClient();
  const [{ data: company }, { data: people }, audit, demo] = await Promise.all([
    supabase.from("company").select("*").maybeSingle(),
    supabase.from("profiles").select("id, full_name, email, title, role, is_active").order("role").order("full_name"),
    session.isPrincipal
      ? supabase.from("audit_log").select("id, occurred_at, actor_id, action, table_name, row_id").order("id", { ascending: false }).limit(50)
      : Promise.resolve({ data: null }),
    session.isManagerPlus ? supabase.rpc("demo_data_counts") : Promise.resolve({ data: null }),
  ]);
  const names = Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name]));
  const counts = (demo.data ?? {}) as Record<string, number>;
  const demoTotal = Object.values(counts).reduce((a, b) => a + Number(b), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" description="Company profile, people and access, audit trail and demo data." />
      <div className="grid gap-5 [&>*]:min-w-0">
        {company && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Company</CardTitle>
                <CardDescription>Used on letterhead and in generated documents.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Legal name</dt>
                  <dd className="mt-0.5">{company.legal_name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Licence</dt>
                  <dd className="num mt-0.5">
                    {company.licence_no} · {company.licensing_authority}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Registered address</dt>
                  <dd className="mt-0.5">{company.address_lines.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Base currency · time zone</dt>
                  <dd className="mt-0.5">
                    {company.base_currency} · {company.timezone}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Principal MFA</dt>
                  <dd className="mt-0.5">
                    {company.require_principal_mfa ? (
                      <Badge variant="success">Required</Badge>
                    ) : (
                      <Badge variant="warning">Not required (local development)</Badge>
                    )}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div>
              <CardTitle>People and access</CardTitle>
              <CardDescription>Invitations and role changes arrive with People &amp; HR in Phase 5.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {(people ?? []).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{p.full_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.title ?? p.email}</span>
                  </span>
                  <Badge variant={ROLE_TONE[p.role]}>{p.role}</Badge>
                  {!p.is_active && <Badge variant="danger">Deactivated</Badge>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {session.isManagerPlus && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Expiry alerts</CardTitle>
                <CardDescription>
                  Runs every day at 07:15 Dubai: contract ends, notice deadlines, survival periods, document expiries and confirmed compliance dates, at 90, 60, 30
                  and 7 days. Each alert goes out once per threshold.
                </CardDescription>
              </div>
              <RunAlerts />
            </CardHeader>
          </Card>
        )}

        {session.isManagerPlus && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Demo data</CardTitle>
                <CardDescription>Seed records are flagged as demo so they can be removed in one step once real data is in.</CardDescription>
              </div>
              <WipeDemo disabled={!session.isPrincipal || demoTotal === 0} />
            </CardHeader>
            <CardContent>
              {demoTotal === 0 ? (
                <p className="text-sm text-muted-foreground">No demo data left.</p>
              ) : (
                <p className="num text-sm text-muted-foreground">
                  {Object.entries(counts)
                    .map(([k, v]) => `${v} ${k}`)
                    .join(" · ")}
                  {!session.isPrincipal && " · only a principal can wipe it."}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {session.isPrincipal && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Audit log</CardTitle>
                <CardDescription>Append-only. The latest 50 entries; search and export arrive in Phase 6.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-normal">When (Dubai)</th>
                    <th className="py-2 pr-3 font-normal">Who</th>
                    <th className="py-2 pr-3 font-normal">Action</th>
                    <th className="py-2 font-normal">Record</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(audit.data ?? []).map((a) => (
                    <tr key={a.id}>
                      <td className="num py-2 pr-3 whitespace-nowrap text-muted-foreground">{fmtDubai(a.occurred_at, "d MMM yyyy, HH:mm:ss")}</td>
                      <td className="py-2 pr-3">{a.actor_id ? (names[a.actor_id] ?? "Unknown user") : "System"}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={a.action === "delete" || a.action.startsWith("wipe") ? "danger" : "outline"}>{a.action}</Badge>
                      </td>
                      <td className="num py-2 text-xs text-muted-foreground">
                        {a.table_name ?? "—"}
                        {a.row_id ? ` · ${a.row_id.slice(0, 8)}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
