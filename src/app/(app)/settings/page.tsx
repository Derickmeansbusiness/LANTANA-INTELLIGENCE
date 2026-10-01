import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { fmtDubai } from "@/lib/dates";
import { getSession } from "@/server/session";
import { WipeDemo } from "./wipe-demo";
import { RunAlerts, RunScan } from "./run-alerts";
import { Invites, PeopleAccess } from "./access";
import { listInvites } from "@/server/data-rooms";

export const metadata: Metadata = { title: "Settings" };

const USAGE_KIND: Record<string, string> = { chat: "Chat", briefing: "Morning briefing", clause_review: "Clause review", ocr: "OCR" };

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
  const [{ data: usage }, invites] = await Promise.all([
    supabase.from("agent_usage_month").select("*"),
    session.isManagerPlus ? listInvites(supabase) : Promise.resolve([]),
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
              <CardDescription>
                {session.isPrincipal
                  ? "Change a role here; it applies on their next page load. Employment records live in People & HR."
                  : "Only a principal can change roles."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <PeopleAccess people={(people ?? []) as Parameters<typeof PeopleAccess>[0]["people"]} me={session.userId} canChangeRoles={session.isPrincipal} />
          </CardContent>
        </Card>

        {session.isManagerPlus && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Invitations</CardTitle>
                <CardDescription>
                  Lantana Command is invite-only: the database refuses any sign-up without an open invite.{" "}
                  {session.isPrincipal ? "Principals can invite anyone." : "Managers can invite external guests; colleagues need a principal."} Guests added to a data room are
                  invited automatically.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Invites invites={invites} isPrincipal={session.isPrincipal} />
            </CardContent>
          </Card>
        )}

        {session.isManagerPlus && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Alerts and scans</CardTitle>
                <CardDescription>
                  Every day at 06:45 Dubai the nightly scan flags overdue tasks, deals with no movement for 14 days and unpaid invoices. At 07:15 the expiry
                  alerts cover contract ends, notice deadlines, survival periods, document expiries and confirmed compliance dates, at 90, 60, 30 and 7 days.
                  Mondays at 07:00 everyone gets a digest of their week. Each item is flagged once.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <RunScan />
                <RunAlerts />
              </div>
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

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Ask Lantana usage this month</CardTitle>
              <CardDescription>
                Tokens sent to and from the model, per person and feature. {session.isPrincipal ? "You see everyone's." : "You see your own."} Cached input is
                billed at a fraction of normal input.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {!usage?.length ? (
              <p className="text-sm text-muted-foreground">No usage yet this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Person</th>
                      <th className="py-1.5 pr-3 font-medium">Feature</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Calls</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Input</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Cached input</th>
                      <th className="py-1.5 text-right font-medium">Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((u) => (
                      <tr key={`${u.user_id}-${u.kind}`} className="border-b last:border-0">
                        <td className="py-1.5 pr-3">{u.full_name}</td>
                        <td className="py-1.5 pr-3">{USAGE_KIND[u.kind ?? ""] ?? u.kind}</td>
                        <td className="num py-1.5 pr-3 text-right">{u.calls}</td>
                        <td className="num py-1.5 pr-3 text-right">{Number(u.input_tokens ?? 0).toLocaleString("en-US")}</td>
                        <td className="num py-1.5 pr-3 text-right">{Number(u.cache_read_tokens ?? 0).toLocaleString("en-US")}</td>
                        <td className="num py-1.5 text-right">{Number(u.output_tokens ?? 0).toLocaleString("en-US")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

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
