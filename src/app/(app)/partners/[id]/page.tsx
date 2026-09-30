import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, ExternalLinkIcon, FileTextIcon, MailIcon, PhoneIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { daysBetween, fmtDate, relativeTime, todayDubai } from "@/lib/dates";
import { formatMoney, toMajor } from "@/lib/money";
import { label } from "@/lib/schemas/common";
import { getSession } from "@/server/session";
import { getOrganization } from "@/server/partners";
import { countryOptions, currencyOptions, orgOptions, peopleOptions } from "@/server/lookups";
import { NotesPanel } from "@/components/shared/notes-panel";
import { EditContactButton, OrgActions } from "@/components/partners/org-actions";

export async function generateMetadata({ params }: PageProps<"/partners/[id]">): Promise<Metadata> {
  const { id } = await params;
  const db = await createClient();
  const { data } = await db.from("organizations").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Organization" };
}

export default async function OrgPage({ params }: PageProps<"/partners/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await getSession();
  const db = await createClient();
  const detail = await getOrganization(db, id);
  if (!detail) notFound();
  const { org } = detail;
  const [countries, currencies, people, orgs] = await Promise.all([countryOptions(db), currencyOptions(db), peopleOptions(db), orgOptions(db)]);
  const today = todayDubai();
  const cur = org.ticket_currency ?? "USD";
  const tmin = org.ticket_min_minor == null ? null : toMajor(org.ticket_min_minor, cur);
  const tmax = org.ticket_max_minor == null ? null : toMajor(org.ticket_max_minor, cur);
  const contactOpts = detail.contacts.map((c) => ({ value: c.id, label: c.full_name, orgId: id }));

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <div>
        <Link href="/partners" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-3.5" /> Partners
        </Link>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight sm:text-[28px]">{org.name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="gold">{label(org.type)}</Badge>
              <Badge variant="outline">{org.country_info?.name ?? "Multi-country"}</Badge>
              <Badge>{label(org.status)}</Badge>
              {org.deleted_at && <Badge variant="danger">Archived</Badge>}
              {org.is_demo && <Badge variant="warning">Demo</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <OrgActions
              orgId={id}
              archived={Boolean(org.deleted_at)}
              canEdit={session.isManagerPlus}
              options={{ countries, currencies, people }}
              contacts={contactOpts}
              deals={detail.deals.map((d) => ({ value: d.id, label: d.name }))}
              initial={{
                name: org.name,
                type: org.type,
                country: org.country ?? "",
                regions_of_interest: org.regions_of_interest,
                sectors: org.sectors,
                ticket_min: tmin == null ? "" : String(tmin),
                ticket_max: tmax == null ? "" : String(tmax),
                ticket_currency: cur,
                website: org.website ?? "",
                description: org.description ?? "",
                relationship_owner_id: org.relationship_owner_id ?? "",
                status: org.status,
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12 [&>*]:min-w-0">
        <div className="space-y-5 xl:col-span-8">
          <Card>
            <CardContent className="pt-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-4">
                <Fact label="Sectors">{org.sectors.map(label).join(", ") || "—"}</Fact>
                <Fact label="Regions">{org.regions_of_interest.map((r: string) => (r === "gcc" ? "GCC" : label(r))).join(", ") || "—"}</Fact>
                <Fact label="Ticket range">
                  {tmin == null && tmax == null ? "—" : `${tmin != null ? formatMoney(tmin, cur) : "…"} – ${tmax != null ? formatMoney(tmax, cur) : "…"}`}
                </Fact>
                <Fact label="Last contact">{org.last_contact_at ? relativeTime(org.last_contact_at) : "Never"}</Fact>
                <Fact label="Relationship owner">{org.owner?.full_name ?? "—"}</Fact>
                {org.linked && <Fact label="Also a Lantana user">{org.linked.full_name}</Fact>}
                {org.website && (
                  <Fact label="Website">
                    <a href={org.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-gold-ink">
                      {org.website.replace(/^https?:\/\//, "")} <ExternalLinkIcon className="size-3" />
                    </a>
                  </Fact>
                )}
              </dl>
              {org.description && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{org.description}</p>}
            </CardContent>
          </Card>

          {session.isManagerPlus && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Agreements</CardTitle>
                  <CardDescription>Contracts with this organization. The full register arrives in Phase 3.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {detail.contracts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No agreements on file.</p>
                ) : (
                  <ul className="space-y-4">
                    {detail.contracts.map((k) => {
                      const flags = [
                        !k.signing_authority_confirmed && "Signing authority not confirmed",
                        !k.signatory_confirmed && "Signatory not confirmed",
                        !k.counterparty_address_confirmed && "Address pending",
                      ].filter(Boolean) as string[];
                      const left = k.end_date ? daysBetween(today, k.end_date) : null;
                      return (
                        <li key={k.id} className="text-sm">
                          <Link href={`?record=contract:${k.id}`} scroll={false} className="font-medium hover:text-gold-ink">
                            {k.title}
                          </Link>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge variant={k.status === "active" ? "success" : "outline"}>{label(k.status)}</Badge>
                            {k.renewal_type === "auto_renew" && <Badge variant="info">Auto-renews · {k.notice_period_days}-day notice</Badge>}
                            {flags.map((f) => (
                              <Badge key={f} variant="danger">
                                {f}
                              </Badge>
                            ))}
                          </div>
                          <p className="num mt-1 text-xs text-muted-foreground">
                            {fmtDate(k.effective_date)} → {fmtDate(k.end_date) || "open-ended"}
                            {left != null && left >= 0 && ` · ${left} days left`}
                            {k.governing_law && ` · ${k.governing_law}`}
                            {k.forum && ` · ${k.forum}`}
                          </p>
                          {k.survival?.length > 0 && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Survives termination: {k.survival.map((s: { clause: string; survival_months: number }) => `${s.clause} (${s.survival_months} months)`).join(", ")}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Interactions</CardTitle>
                <CardDescription>Calls, meetings, emails and visits, newest first.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {detail.interactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing logged yet. Use Log interaction after every call or meeting; it keeps last contact honest.</p>
              ) : (
                <ol className="space-y-3">
                  {detail.interactions.map((i) => (
                    <li key={i.id} className="text-sm">
                      <p className="num text-xs text-muted-foreground">
                        {fmtDate(i.occurred_on)} · {label(i.kind)}
                        {i.contact && ` with ${i.contact.full_name}`}
                        {i.author && ` · logged by ${i.author.full_name}`}
                      </p>
                      <p className="mt-0.5">{i.summary}</p>
                      {i.deal && (
                        <Link href={`/deals/${i.deal.id}`} className="text-xs text-gold-ink hover:underline">
                          {i.deal.name}
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Introductions</CardTitle>
                <CardDescription>Ledger entries where this organization was one of the parties.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {detail.introductions.length === 0 ? (
                <p className="text-sm text-muted-foreground">None recorded.</p>
              ) : (
                <ol className="space-y-3">
                  {detail.introductions.map((i) => {
                    const other = i.a?.id === id ? i.b : i.a;
                    return (
                      <li key={i.id} className="text-sm">
                        <p className="num text-xs text-muted-foreground">
                          #{i.seq} · {fmtDate(i.introduced_on)} · {label(i.channel)}
                        </p>
                        <p className="mt-0.5">
                          Introduced to{" "}
                          <Link href={`/partners/${other?.id}`} className="hover:text-gold-ink">
                            {other?.name}
                          </Link>
                        </p>
                        <p className="text-muted-foreground">{i.summary}</p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts recorded.</p>
              ) : (
                <ul className="space-y-3">
                  {detail.contacts.map((c) => (
                    <li key={c.id} className="flex gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{c.full_name}</p>
                        {c.job_title && <p className="text-xs text-muted-foreground">{c.job_title}</p>}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-gold-ink">
                              <MailIcon className="size-3" /> {c.email}
                            </a>
                          )}
                          {c.phone && (
                            <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="num inline-flex items-center gap-1 text-muted-foreground hover:text-gold-ink">
                              <PhoneIcon className="size-3" /> {c.phone}
                            </a>
                          )}
                        </div>
                      </div>
                      {session.isManagerPlus && (
                        <EditContactButton
                          contactId={c.id}
                          orgs={orgs}
                          countries={countries}
                          initial={{ organization_id: id, full_name: c.full_name, job_title: c.job_title ?? "", email: c.email ?? "", phone: c.phone ?? "", country: c.country ?? "", notes: c.notes ?? "" }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deals</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.deals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not on any deal yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {detail.deals.map((d) => (
                    <li key={d.id} className="flex items-center gap-2">
                      <Link href={`/deals/${d.id}`} className="min-w-0 flex-1 truncate hover:text-gold-ink">
                        {d.name}
                      </Link>
                      <Badge variant="outline">{d.role}</Badge>
                      <Badge variant="gold">{d.label}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <NotesPanel entityType="organization" entityId={id} notes={detail.notes as never} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents linked.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {detail.documents.map((d) => (
                    <li key={d!.id}>
                      <Link href={`?record=document:${d!.id}`} scroll={false} className="flex items-center gap-2 hover:text-gold-ink">
                        <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" /> {d!.title}
                      </Link>
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
      <dd className="num mt-0.5 break-words">{children}</dd>
    </div>
  );
}
