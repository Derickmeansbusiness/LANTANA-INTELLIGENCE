import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, FileTextIcon, LockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { daysBetween, fmtDate, todayDubai } from "@/lib/dates";
import { label } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";
import { getSession } from "@/server/session";
import { getEmployee } from "@/server/people";
import { countryOptions, currencyOptions, peopleOptions } from "@/server/lookups";
import { ChecklistPanel, EmployeeActions, IdentityPanel, LeaveList, PayPanel, type ChecklistView, type LeaveItem } from "@/components/people/employee-panels";
import { employeeStatusVariant } from "@/components/people/format";

export async function generateMetadata({ params }: PageProps<"/people/[id]">): Promise<Metadata> {
  const { id } = await params;
  const db = await createClient();
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await db.from("employees").select("full_name").eq("id", id).maybeSingle() : { data: null };
  return { title: data?.full_name ?? "Employee" };
}

const DOCS = [
  ["visa_expiry", "Residence visa"],
  ["emirates_id_expiry", "Emirates ID"],
  ["labour_card_expiry", "Labour card"],
  ["passport_expiry", "Passport"],
  ["insurance_expiry", "Health insurance"],
] as const;

const s = (v: unknown) => (typeof v === "string" ? v : "");

export default async function EmployeePage({ params }: PageProps<"/people/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await getSession();
  const db = await createClient();
  // RLS: managers and principals see everyone; anyone else only their own record.
  const detail = await getEmployee(db, id);
  if (!detail) notFound();
  const { e, balances, leave, checklists, identity, documents } = detail;
  const isSelf = e.profile?.id === session.userId;
  const [people, countries, currencies, employees] = await Promise.all([
    peopleOptions(db),
    session.isPrincipal ? countryOptions(db) : Promise.resolve([]),
    session.isPrincipal ? currencyOptions(db) : Promise.resolve([]),
    session.isManagerPlus ? db.from("employees").select("id, full_name").is("deleted_at", null).neq("status", "left").order("full_name") : Promise.resolve({ data: [] }),
  ]);
  const today = todayDubai();

  return (
    <div>
      {session.isManagerPlus && (
        <Link href="/people" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-3.5" /> Team
        </Link>
      )}
      <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-2xl">{e.full_name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={employeeStatusVariant(e.status)}>{label(e.status)}</Badge>
            {Boolean(e.is_demo) && <Badge variant="outline">Demo</Badge>}
            <span>{[s(e.job_title), s(e.department)].filter(Boolean).join(" · ")}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EmployeeActions
            id={id}
            canEdit={session.isManagerPlus}
            canRequestLeave={isSelf || session.isManagerPlus}
            options={{
              employees: (employees.data ?? []).map((x) => ({ value: x.id, label: x.full_name })),
              logins: people,
            }}
            initial={{
              full_name: e.full_name,
              job_title: s(e.job_title),
              department: s(e.department),
              work_email: s(e.work_email),
              phone: s(e.phone),
              manager_id: e.manager?.id ?? "",
              profile_id: e.profile?.id ?? "",
              employment_type: s(e.employment_type),
              status: e.status,
              on_payroll: Boolean(e.on_payroll),
              start_date: s(e.start_date),
              end_date: s(e.end_date),
              probation_end: s(e.probation_end),
              work_location: s(e.work_location),
              visa_expiry: s(e.visa_expiry),
              emirates_id_expiry: s(e.emirates_id_expiry),
              labour_card_expiry: s(e.labour_card_expiry),
              passport_expiry: s(e.passport_expiry),
              insurance_expiry: s(e.insurance_expiry),
            }}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Leave</CardTitle>
                <CardDescription>This year’s balances and every request.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {balances.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {balances.map((b) => (
                    <div key={b.kind ?? ""} className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">{label(b.kind ?? "")}</p>
                      <p className="num mt-1 text-lg font-semibold">{Number(b.remaining_days)} d</p>
                      <p className="num text-[11px] text-muted-foreground">
                        of {Number(b.entitled_days) + Number(b.carried_over)} · {Number(b.pending_days)} pending
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No entitlement set for this year. UAE law gives 30 calendar days of annual leave after a year of service.</p>
              )}
              <LeaveList items={leave as unknown as LeaveItem[]} canDecide={session.isManagerPlus && (!isSelf || session.isPrincipal)} canCancelOwn={isSelf || session.isManagerPlus} />
            </CardContent>
          </Card>

          {checklists.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Checklists</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {checklists.map((c) => (
                  <ChecklistPanel key={c.id} list={c as unknown as ChecklistView} me={session.userId} canManage={session.isManagerPlus} people={people} />
                ))}
              </CardContent>
            </Card>
          )}

          {session.isManagerPlus && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Pay</CardTitle>
                  <CardDescription>Effective-dated salary and allowances.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {session.isPrincipal ? (
                  <PayPanel employeeId={id} startDate={e.start_date} endDate={e.end_date} currencies={currencies} />
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LockIcon className="size-4" /> Pay is visible to principals only.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Employment</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Contract</dt>
                <dd>{label(s(e.employment_type))}</dd>
                <dt className="text-muted-foreground">Reports to</dt>
                <dd>{e.manager ? <Link href={`/people/${e.manager.id}`} className="hover:text-gold-ink">{e.manager.full_name}</Link> : "—"}</dd>
                <dt className="text-muted-foreground">Started</dt>
                <dd className="num">{e.start_date ? fmtDate(e.start_date) : "—"}</dd>
                <dt className="text-muted-foreground">Probation ends</dt>
                <dd className="num">{e.probation_end ? fmtDate(s(e.probation_end)) : "—"}</dd>
                {e.end_date && (
                  <>
                    <dt className="text-muted-foreground">Last day</dt>
                    <dd className="num">{fmtDate(e.end_date)}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Location</dt>
                <dd>{s(e.work_location) || "—"}</dd>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="min-w-0 truncate">{s(e.work_email) || "—"}</dd>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{s(e.phone) || "—"}</dd>
                <dt className="text-muted-foreground">Payroll</dt>
                <dd>{e.on_payroll ? "Paid through payroll" : "Not on payroll"}</dd>
                <dt className="text-muted-foreground">Login</dt>
                <dd className="min-w-0 truncate">{e.profile?.email ?? "None"}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Document expiries</CardTitle>
                <CardDescription>Alerts at 90, 60, 30 and 7 days.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {DOCS.map(([k, what]) => {
                  const d = s(e[k]);
                  const days = d ? daysBetween(today, d) : null;
                  return (
                    <li key={k} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{what}</span>
                      <span className={cn("num", days != null && days <= 30 && "text-danger", days != null && days > 30 && days <= 60 && "text-warning")}>
                        {d ? `${fmtDate(d)}${days != null ? ` · ${days < 0 ? `expired ${-days} d ago` : `${days} d`}` : ""}` : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {session.isPrincipal && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Identity and bank</CardTitle>
                  <CardDescription>Principals only.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <IdentityPanel employeeId={id} identity={identity} countries={countries} />
              </CardContent>
            </Card>
          )}

          {documents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {documents.map((d) => (
                    <li key={d.id}>
                      <Link href={`/documents/${d.id}`} className="inline-flex items-center gap-2 hover:text-gold-ink">
                        <FileTextIcon className="size-3.5 text-muted-foreground" /> {d.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
