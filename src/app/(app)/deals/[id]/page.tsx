import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, CircleDotIcon, FileTextIcon, MessageCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtDubai, todayDubai } from "@/lib/dates";
import { formatCompact, formatMoney } from "@/lib/money";
import { label } from "@/lib/schemas/common";
import { getSession } from "@/server/session";
import { getDeal, matchInvestors } from "@/server/deals";
import { contactOptions, countryOptions, currencyOptions, orgOptions, peopleOptions, stageOptions } from "@/server/lookups";
import { NotesPanel } from "@/components/shared/notes-panel";
import {
  DealActions,
  DealIntroductions,
  DealTasks,
  LogInteractionButton,
  MatcherPanel,
  PartiesPanel,
  StageStepper,
  TeamPanel,
} from "@/components/deals/deal-detail";

export async function generateMetadata({ params }: PageProps<"/deals/[id]">): Promise<Metadata> {
  const { id } = await params;
  const db = await createClient();
  const { data } = await db.from("deals").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Deal" };
}

export default async function DealPage({ params }: PageProps<"/deals/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await getSession();
  const db = await createClient();
  const detail = await getDeal(db, id);
  if (!detail) notFound();
  const { deal } = detail;

  const [matches, stages, people, orgs, contacts, countries, currencies, dealList] = await Promise.all([
    matchInvestors(db, id),
    stageOptions(db),
    peopleOptions(db),
    orgOptions(db),
    contactOptions(db),
    countryOptions(db),
    currencyOptions(db),
    db.from("deals").select("id, name").is("deleted_at", null).order("name"),
  ]);
  const introOptions = { orgs, contacts, deals: (dealList.data ?? []).map((d) => ({ value: d.id, label: d.name })) };
  const archived = Boolean(deal.deleted_at);
  const probability = deal.probability ?? deal.stage_info?.default_probability ?? 0;
  const today = todayDubai();

  const timeline = [
    ...detail.history.map((h) => ({
      key: `h${h.id}`,
      at: h.changed_at,
      icon: "stage" as const,
      title: h.from_stage ? `Moved to ${stages.find((s) => s.key === h.to_stage)?.label ?? h.to_stage}` : `Created at ${stages.find((s) => s.key === h.to_stage)?.label ?? h.to_stage}`,
      body: h.note,
      who: (h.who as { full_name: string } | null)?.full_name ?? null,
    })),
    ...detail.interactions.map((i) => ({
      key: `i${i.id}`,
      at: `${i.occurred_on}T12:00:00+04:00`,
      icon: "interaction" as const,
      title: `${label(i.kind)}${i.org ? ` with ${(i.org as { name: string }).name}` : ""}`,
      body: i.summary,
      who: null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <div>
        <Link href="/deals" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-3.5" /> Deals
        </Link>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight sm:text-[28px]">{deal.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="gold">{deal.stage_info?.label}</Badge>
              <Badge>{label(deal.sector)}</Badge>
              {deal.country_info && <Badge variant="outline">{deal.country_info.name}</Badge>}
              {deal.spv_planned && <Badge variant="info">SPV planned</Badge>}
              {archived && <Badge variant="danger">Archived</Badge>}
              {deal.is_demo && <Badge variant="warning">Demo</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <DealActions
              deal={{ id: deal.id, name: deal.name }}
              stage={deal.stage}
              archived={archived}
              canArchive={session.isManagerPlus}
              options={{ stages, people, orgs, countries, currencies }}
              introOptions={introOptions}
              initial={{
                name: deal.name,
                sector: deal.sector,
                country: deal.country ?? "",
                ticket: detail.ticketMajor == null ? "" : String(detail.ticketMajor),
                currency: deal.currency,
                stage: deal.stage,
                probability: deal.probability == null ? "" : String(deal.probability),
                expected_close_date: deal.expected_close_date ?? "",
                owner_id: deal.owner_id ?? "",
                project_owner_org_id: deal.project_owner_org_id ?? "",
                introducer_org_id: deal.introducer_org_id ?? "",
                fee_terms: deal.fee_terms ?? "",
                spv_planned: deal.spv_planned,
                next_step: deal.next_step ?? "",
                next_step_due: deal.next_step_due ?? "",
                summary: deal.summary ?? "",
              }}
            />
          </div>
        </div>
      </div>

      <StageStepper stages={stages} current={deal.stage} />

      <div className="grid gap-5 xl:grid-cols-12 [&>*]:min-w-0">
        <div className="space-y-5 xl:col-span-8">
          <Card>
            <CardContent className="pt-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-4">
                <Fact label="Ticket">{detail.ticketMajor == null ? "Not set" : formatMoney(detail.ticketMajor, deal.currency)}</Fact>
                <Fact label="In USD">{detail.valueUsd == null ? "—" : formatCompact(detail.valueUsd, "USD")}</Fact>
                <Fact label="Probability">{probability}%</Fact>
                <Fact label="Weighted">{detail.valueUsd == null ? "—" : formatCompact((detail.valueUsd * probability) / 100, "USD")}</Fact>
                <Fact label="Expected close">{fmtDate(deal.expected_close_date) || "Not set"}</Fact>
                <Fact label="Project owner">{deal.project_owner ? <Link className="hover:text-gold-ink" href={`/partners/${deal.project_owner.id}`}>{deal.project_owner.name}</Link> : "—"}</Fact>
                <Fact label="Introduced by">{deal.introducer ? <Link className="hover:text-gold-ink" href={`/partners/${deal.introducer.id}`}>{deal.introducer.name}</Link> : "Direct"}</Fact>
                <Fact label="Lantana fee">{deal.fee_terms ?? "To be agreed"}</Fact>
              </dl>
              {deal.next_step && (
                <p className={`mt-4 rounded-md border px-3 py-2 text-sm ${deal.next_step_due && deal.next_step_due < today ? "border-danger/40 bg-danger/5" : ""}`}>
                  <span className="text-muted-foreground">Next step · </span>
                  {deal.next_step}
                  {deal.next_step_due && <span className="num text-muted-foreground"> · by {fmtDate(deal.next_step_due)}</span>}
                </p>
              )}
              {deal.summary && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{deal.summary}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Tasks</CardTitle>
                <CardDescription>Everything that has to happen for this deal to move.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <DealTasks dealId={deal.id} tasks={detail.tasks as never} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Introductions</CardTitle>
                <CardDescription>Lantana&apos;s record of who was put in touch with whom. Permanent and hash-chained.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <DealIntroductions dealId={deal.id} intros={detail.introductions as never} introOptions={introOptions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Timeline</CardTitle>
                <CardDescription>Stage changes and interactions, newest first.</CardDescription>
              </div>
              <LogInteractionButton dealId={deal.id} contacts={contacts} />
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l pl-5">
                {timeline.map((t) => (
                  <li key={t.key} className="relative text-sm">
                    <span className="absolute top-1 -left-[27px] flex size-3.5 items-center justify-center rounded-full border bg-surface">
                      {t.icon === "stage" ? <CircleDotIcon className="size-2.5 text-gold" /> : <MessageCircleIcon className="size-2.5 text-muted-foreground" />}
                    </span>
                    <p>
                      {t.title}
                      {t.who && <span className="text-muted-foreground"> · {t.who}</span>}
                    </p>
                    {t.body && <p className="mt-0.5 text-muted-foreground">{t.body}</p>}
                    <p className="num mt-0.5 text-[11px] text-muted-foreground">{fmtDubai(t.at, "d MMM yyyy")}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 xl:col-span-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Who do we know for this?</CardTitle>
                <CardDescription>Investors ranked on sector, geography and ticket fit. Hover a score for the breakdown.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <MatcherPanel dealId={deal.id} matches={matches} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Parties</CardTitle>
            </CardHeader>
            <CardContent>
              <PartiesPanel dealId={deal.id} parties={detail.parties as never} orgs={orgs} canManage={session.isManagerPlus} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Team</CardTitle>
                <CardDescription>Staff only see deals they own or are added to.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <TeamPanel dealId={deal.id} ownerName={deal.owner?.full_name ?? null} members={detail.members as never} people={people} canManage={session.isManagerPlus} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <NotesPanel entityType="deal" entityId={deal.id} notes={detail.notes as never} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Documents</CardTitle>
                <CardDescription>Uploads and the vault arrive in Phase 3.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {detail.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents linked.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {detail.documents.map((d) => (
                    <li key={d!.id}>
                      <Link href={`?record=document:${d!.id}`} scroll={false} className="flex items-center gap-2 hover:text-gold-ink">
                        <FileTextIcon className="size-3.5 text-muted-foreground" /> {d!.title}
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
      <dd className="num mt-0.5 truncate">{children}</dd>
    </div>
  );
}
