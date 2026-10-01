import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangleIcon, BellIcon, ChevronLeftIcon, FileTextIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtDubai, shiftDate } from "@/lib/dates";
import { ALERT_THRESHOLDS, addMonths } from "@/lib/contract-dates";
import { CONTRACT_TYPE_LABEL } from "@/lib/schemas/contracts";
import { label } from "@/lib/schemas/common";
import { getSession } from "@/server/session";
import { getContract } from "@/server/contracts";
import { agentAvailable } from "@/server/agent/config";
import { TEMPLATE_FOR, type ReviewResult } from "@/server/agent/clause-review";

type Finding = ReviewResult["findings"][number];
import { orgOptions, peopleOptions } from "@/server/lookups";
import { ContractActions, ObligationsPanel, SurvivalPanel, type Obligation } from "@/components/contracts/contract-panels";
import { statusVariant, urgency } from "@/components/contracts/format";

export async function generateMetadata({ params }: PageProps<"/contracts/[id]">): Promise<Metadata> {
  const { id } = await params;
  const db = await createClient();
  const { data } = await db.from("contracts").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Contract" };
}

const ALERT_KIND: Record<string, string> = { contract_end: "Term ends", notice_deadline: "Notice deadline", survival_end: "Survival lapses" };

export default async function ContractPage({ params }: PageProps<"/contracts/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await getSession();
  if (!session.isManagerPlus) notFound();
  const db = await createClient();
  const detail = await getContract(db, id);
  if (!detail) notFound();
  const { k, survival, obligations, alerts, linkedDocs, dates, flags, today } = detail;
  const [orgs, people, docs, { data: review }] = await Promise.all([
    orgOptions(db),
    peopleOptions(db),
    db.from("documents").select("id, title").is("deleted_at", null).in("doc_type", ["agreement", "lease", "letter"]).order("title"),
    db
      .from("clause_reviews")
      .select("id, summary, findings, created_at, template_id, document:documents(id, title), author:profiles!clause_reviews_created_by_fkey(full_name)")
      .eq("contract_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; summary: string; findings: Finding[]; created_at: string; template_id: string; document: { id: string; title: string } | null; author: { full_name: string } | null }>(),
  ]);
  const reviewBlocked = !agentAvailable()
    ? "Needs an Anthropic API key on the server (ANTHROPIC_API_KEY)."
    : !TEMPLATE_FOR[k.contract_type]
      ? "Lantana has no standard template for this type of contract yet."
      : !k.document_id
        ? "Link the counterparty's document first (Edit → Signed copy in the vault)."
        : null;
  const archived = Boolean(k.deleted_at);
  const typeLabel = CONTRACT_TYPE_LABEL[k.contract_type as keyof typeof CONTRACT_TYPE_LABEL] ?? label(k.contract_type);

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <div>
        <Link href="/contracts" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-3.5" /> Contracts
        </Link>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight sm:text-[28px]">{k.title}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="gold">{typeLabel}</Badge>
              <Badge variant={statusVariant(k.status)}>{label(k.status)}</Badge>
              {k.renewal_type === "auto_renew" && <Badge variant="info">Auto-renews · {k.notice_period_days}-day notice</Badge>}
              {k.esign_status && <Badge variant="outline">E-signature: {label(k.esign_status)}</Badge>}
              {archived && <Badge variant="danger">Archived</Badge>}
              {k.is_demo && <Badge variant="warning">Demo</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ContractActions
              id={id}
              archived={archived}
              reviewBlocked={archived ? "Archived contracts can't be reviewed." : reviewBlocked}
              options={{ orgs, people, documents: (docs.data ?? []).map((d) => ({ value: d.id, label: d.title })) }}
              initial={{
                title: k.title,
                contract_type: k.contract_type,
                status: k.status,
                counterparty_org_id: k.counterparty_org_id ?? "",
                document_id: k.document_id ?? "",
                owner_id: k.owner_id ?? "",
                effective_date: k.effective_date ?? "",
                term_months: k.term_months?.toString() ?? "",
                end_date: k.end_date ?? "",
                renewal_type: k.renewal_type,
                notice_period_days: k.notice_period_days?.toString() ?? "",
                governing_law: k.governing_law ?? "",
                forum: k.forum ?? "",
                exclusivity: k.exclusivity ?? "",
                fee_terms: k.fee_terms ?? "",
                signatory_name: k.signatory_name ?? "",
                signatory_confirmed: k.signatory_confirmed,
                signing_authority_confirmed: k.signing_authority_confirmed,
                counterparty_address_confirmed: k.counterparty_address_confirmed,
                esign_status: k.esign_status ?? "",
                notes: k.notes ?? "",
              }}
            />
          </div>
        </div>
      </div>

      {flags.length > 0 && (
        <div role="status" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-warning">
            <AlertTriangleIcon className="size-4" /> Needs confirming
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
            {flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-12 [&>*]:min-w-0">
        <div className="space-y-5 xl:col-span-8">
          <Card>
            <CardContent className="pt-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-3">
                <Fact label="Counterparty">
                  {k.org ? (
                    <Link href={`/partners/${k.org.id}`} className="hover:text-gold-ink">
                      {k.org.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Fact>
                <Fact label="Owner">{k.owner?.full_name ?? "—"}</Fact>
                <Fact label="Signatory">{k.signatory_name ?? "—"}</Fact>
                <Fact label="Effective">{k.effective_date ? fmtDate(k.effective_date) : "—"}</Fact>
                <Fact label="Term">{k.term_months ? `${k.term_months} months` : "—"}</Fact>
                <Fact label="Ends">{k.end_date ? fmtDate(k.end_date) : "—"}</Fact>
                <Fact label="Governing law">{k.governing_law ?? "—"}</Fact>
                <Fact label="Disputes">{k.forum ?? "—"}</Fact>
                <Fact label="Exclusivity">{k.exclusivity ?? "—"}</Fact>
              </dl>
              {k.fee_terms && (
                <div className="mt-4 text-sm">
                  <dt className="text-xs text-muted-foreground">Fees</dt>
                  <dd className="mt-0.5">{k.fee_terms}</dd>
                </div>
              )}
              {k.notes && <p className="mt-4 rounded-md bg-surface-2 p-3 text-sm leading-relaxed text-muted-foreground">{k.notes}</p>}
            </CardContent>
          </Card>

          {review && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <SparklesIcon className="size-4 text-gold" /> Clause review
                  </CardTitle>
                  <CardDescription>
                    {review.document?.title ?? "Document"} against Lantana&apos;s standard template · {review.author?.full_name ?? "—"},{" "}
                    <span className="num">{fmtDubai(review.created_at, "d MMM yyyy, HH:mm")}</span>. Not legal advice: take it to counsel.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{review.summary}</p>
                {review.findings.length > 0 && (
                  <ol className="mt-3 space-y-3">
                    {review.findings.map((f, i) => (
                      <li key={i} className="rounded-md border p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={f.severity === "high" ? "danger" : f.severity === "medium" ? "warning" : "outline"}>{label(f.severity)}</Badge>
                          <span className="font-medium">{f.clause}</span>
                        </div>
                        <p className="mt-1.5">{f.issue}</p>
                        {(f.their_text || f.lantana_standard) && (
                          <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                            {f.their_text && (
                              <div className="min-w-0">
                                <dt className="text-muted-foreground">Their draft</dt>
                                <dd className="italic">&ldquo;{f.their_text}&rdquo;</dd>
                              </div>
                            )}
                            {f.lantana_standard && (
                              <div className="min-w-0">
                                <dt className="text-muted-foreground">Lantana standard</dt>
                                <dd>{f.lantana_standard}</dd>
                              </div>
                            )}
                          </dl>
                        )}
                        {f.suggestion && <p className="mt-2 text-xs text-muted-foreground">Ask for: {f.suggestion}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Obligations</CardTitle>
                <CardDescription>What Lantana or the counterparty must do. Dated obligations become tasks for their owner.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ObligationsPanel contractId={id} items={obligations as unknown as Obligation[]} people={people} today={today} archived={archived} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Survival clauses</CardTitle>
                <CardDescription>Terms that keep binding after the contract ends. Alerts fire before each one lapses.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <SurvivalPanel
                contractId={id}
                endDate={k.end_date}
                archived={archived}
                items={survival.map((s) => ({ ...s, lapses: k.end_date ? addMonths(k.end_date, s.survival_months) : null }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 xl:col-span-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Key dates</CardTitle>
                <CardDescription>Owner, managers and principals are notified 90, 60, 30 and 7 days before each.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {dates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No end date set, so nothing to count down to.</p>
              ) : (
                <ol className="relative space-y-4 border-l pl-4">
                  {dates.map((d) => {
                    const past = d.daysLeft < 0;
                    const next = ALERT_THRESHOLDS.map((t) => ({ t, on: shiftDate(d.date, -t) })).filter((x) => x.on >= today);
                    return (
                      <li key={`${d.kind}-${d.date}-${d.label}`} className="text-sm">
                        <span className={`absolute -left-[5px] mt-1.5 size-2.5 rounded-full ${past ? "bg-border" : "bg-gold"}`} aria-hidden />
                        <p className={past ? "text-muted-foreground" : "font-medium"}>{d.label}</p>
                        <p className="text-xs">
                          <span className="num">{fmtDate(d.date)}</span>{" "}
                          <span className={past ? "text-muted-foreground" : urgency(d.daysLeft)}>
                            · {past ? `${-d.daysLeft} days ago` : d.daysLeft === 0 ? "today" : `in ${d.daysLeft} days`}
                          </span>
                        </p>
                        {!past && next.length > 0 && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Alerts: {next.map((x) => `${x.t}d (${fmtDate(x.on, "d MMM")})`).join(", ")}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {k.document && (
                  <li className="flex items-center gap-1.5">
                    <FileTextIcon className="size-4 shrink-0 text-gold" />
                    <Link href={`/documents/${k.document.id}`} className="min-w-0 truncate hover:text-gold-ink">
                      {k.document.title}
                    </Link>
                    <Badge variant="outline">Signed copy</Badge>
                  </li>
                )}
                {linkedDocs
                  .filter((d) => d.id !== k.document?.id)
                  .map((d) => (
                    <li key={d.id} className="flex items-center gap-1.5">
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                      <Link href={`/documents/${d.id}`} className="min-w-0 truncate hover:text-gold-ink">
                        {d.title}
                      </Link>
                    </li>
                  ))}
                {!k.document && linkedDocs.length === 0 && <li className="text-muted-foreground">Nothing in the vault yet. Upload the signed copy and link it here.</li>}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Alerts sent</CardTitle>
                <CardDescription>From the daily 07:15 Dubai run.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {alerts.map((a) => (
                    <li key={`${a.kind}-${a.threshold_days}-${a.target_date}`} className="flex items-start gap-2">
                      <BellIcon className="mt-0.5 size-3.5 shrink-0 text-gold" />
                      <span className="min-w-0">
                        {ALERT_KIND[a.kind] ?? label(a.kind)} · {a.threshold_days}-day alert
                        <span className="block text-xs text-muted-foreground">
                          for <span className="num">{fmtDate(a.target_date)}</span>, sent <span className="num">{fmtDubai(a.sent_at, "d MMM yyyy, HH:mm")}</span>
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Fact({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{l}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}
