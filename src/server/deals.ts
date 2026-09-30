import "server-only";
import type { Db } from "@/lib/supabase/server";
import { fail, fieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { createDealSchema, dealSchema, introductionSchema, moveStageSchema, partySchema } from "@/lib/schemas/deals";
import { toMajor, toMinor } from "@/lib/money";
import { todayDubai } from "@/lib/dates";

/**
 * Deals domain. Every function takes the caller's Supabase client, so RLS
 * decides what it can read or change. Server actions and (Phase 4) agent
 * tools both call these; neither talks to the tables directly.
 */

export type DealRow = {
  id: string;
  name: string;
  country: string | null;
  country_name: string | null;
  sector: string;
  stage: string;
  stage_label: string;
  stage_order: number;
  is_terminal: boolean;
  ticket_minor: number | null;
  currency: string;
  ticket_major: number | null;
  value_usd: number | null;
  probability: number;
  weighted_usd: number | null;
  owner_id: string | null;
  owner_name: string | null;
  introducer: string | null;
  project_owner: string | null;
  next_step: string | null;
  next_step_due: string | null;
  expected_close_date: string | null;
  last_activity_at: string;
  is_demo: boolean;
};

/** USD per 1 unit of each currency, from the same stored rates the SQL uses. */
async function usdRates(db: Db, onDate = todayDubai()) {
  const { data } = await db.from("fx_rates").select("base, quote, rate, rate_date").eq("quote", "AED").lte("rate_date", onDate).order("rate_date", { ascending: false });
  const toAed = new Map<string, number>([["AED", 1]]);
  for (const r of data ?? []) if (!toAed.has(r.base)) toAed.set(r.base, Number(r.rate));
  const usdAed = toAed.get("USD");
  return (cur: string) => {
    const a = toAed.get(cur);
    return a && usdAed ? a / usdAed : null;
  };
}

export async function listDeals(db: Db, opts: { includeArchived?: boolean } = {}): Promise<DealRow[]> {
  let q = db
    .from("deals")
    .select(
      "id, name, country, sector, stage, ticket_minor, currency, probability, owner_id, next_step, next_step_due, expected_close_date, last_activity_at, is_demo, deleted_at, " +
        "stage_info:pipeline_stages(label, sort_order, default_probability, is_terminal), country_info:countries(name), owner:profiles!deals_owner_id_fkey(full_name), " +
        "introducer:organizations!deals_introducer_org_id_fkey(name), project_owner:organizations!deals_project_owner_org_id_fkey(name)",
    )
    .order("name");
  if (!opts.includeArchived) q = q.is("deleted_at", null);
  const [{ data, error }, rate] = await Promise.all([q.returns<RawDeal[]>(), usdRates(db)]);
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => {
    const major = d.ticket_minor == null ? null : toMajor(d.ticket_minor, d.currency);
    const r = rate(d.currency);
    const usd = major == null || r == null ? null : major * r;
    const p = d.probability ?? d.stage_info?.default_probability ?? 0;
    return {
      id: d.id,
      name: d.name,
      country: d.country,
      country_name: d.country_info?.name ?? null,
      sector: d.sector,
      stage: d.stage,
      stage_label: d.stage_info?.label ?? d.stage,
      stage_order: d.stage_info?.sort_order ?? 0,
      is_terminal: d.stage_info?.is_terminal ?? false,
      ticket_minor: d.ticket_minor,
      currency: d.currency,
      ticket_major: major,
      value_usd: usd,
      probability: p,
      weighted_usd: usd == null ? null : (usd * p) / 100,
      owner_id: d.owner_id,
      owner_name: d.owner?.full_name ?? null,
      introducer: d.introducer?.name ?? null,
      project_owner: d.project_owner?.name ?? null,
      next_step: d.next_step,
      next_step_due: d.next_step_due,
      expected_close_date: d.expected_close_date,
      last_activity_at: d.last_activity_at,
      is_demo: d.is_demo,
    };
  });
}

type RawDeal = {
  id: string;
  name: string;
  country: string | null;
  sector: string;
  stage: string;
  ticket_minor: number | null;
  currency: string;
  probability: number | null;
  owner_id: string | null;
  next_step: string | null;
  next_step_due: string | null;
  expected_close_date: string | null;
  last_activity_at: string;
  is_demo: boolean;
  deleted_at: string | null;
  stage_info: { label: string; sort_order: number; default_probability: number; is_terminal: boolean } | null;
  country_info: { name: string } | null;
  owner: { full_name: string } | null;
  introducer: { name: string } | null;
  project_owner: { name: string } | null;
};

export async function getDeal(db: Db, id: string) {
  const { data: deal } = await db
    .from("deals")
    .select(
      "*, stage_info:pipeline_stages(label, sort_order, default_probability, is_terminal, is_won), country_info:countries(name, region), owner:profiles!deals_owner_id_fkey(id, full_name), " +
        "introducer:organizations!deals_introducer_org_id_fkey(id, name), project_owner:organizations!deals_project_owner_org_id_fkey(id, name)",
    )
    .eq("id", id)
    .maybeSingle<DealDetail>();
  if (!deal) return null;

  const [history, parties, members, intros, tasks, notes, interactions, docs, rate] = await Promise.all([
    db.from("deal_stage_history").select("id, from_stage, to_stage, changed_at, note, who:profiles!deal_stage_history_changed_by_fkey(full_name)").eq("deal_id", id).order("changed_at", { ascending: false }),
    db.from("deal_parties").select("id, role, notes, org:organizations(id, name, type)").eq("deal_id", id).order("created_at"),
    db.from("deal_members").select("role, user:profiles!deal_members_user_id_fkey(id, full_name)").eq("deal_id", id),
    db.from("introductions").select("id, seq, introduced_on, channel, summary, corrects_id, a:organizations!introductions_party_a_org_id_fkey(name), b:organizations!introductions_party_b_org_id_fkey(name)").eq("deal_id", id).order("seq", { ascending: false }),
    db.from("tasks").select("id, title, status, priority, due_date, assignee:profiles!tasks_assignee_id_fkey(full_name)").eq("deal_id", id).is("deleted_at", null).order("due_date", { nullsFirst: false }),
    db.from("notes").select("id, body, pinned, created_at, author:profiles!notes_created_by_fkey(full_name)").eq("entity_type", "deal").eq("entity_id", id).is("deleted_at", null).order("pinned", { ascending: false }).order("created_at", { ascending: false }),
    db.from("interactions").select("id, kind, occurred_on, summary, org:organizations(name)").eq("deal_id", id).is("deleted_at", null).order("occurred_on", { ascending: false }),
    db.from("document_links").select("document:documents(id, title, status, doc_type)").eq("entity_type", "deal").eq("entity_id", id),
    usdRates(db),
  ]);

  const major = deal.ticket_minor == null ? null : toMajor(deal.ticket_minor, deal.currency);
  const r = rate(deal.currency);
  return {
    deal,
    ticketMajor: major,
    valueUsd: major == null || r == null ? null : major * r,
    history: history.data ?? [],
    parties: parties.data ?? [],
    members: members.data ?? [],
    introductions: intros.data ?? [],
    tasks: tasks.data ?? [],
    notes: notes.data ?? [],
    interactions: interactions.data ?? [],
    documents: (docs.data ?? []).map((d) => d.document).filter(Boolean),
  };
}

export type DealDetail = {
  id: string;
  name: string;
  country: string | null;
  sector: string;
  ticket_minor: number | null;
  currency: string;
  stage: string;
  probability: number | null;
  project_owner_org_id: string | null;
  introducer_org_id: string | null;
  fee_terms: string | null;
  spv_planned: boolean;
  next_step: string | null;
  next_step_due: string | null;
  expected_close_date: string | null;
  owner_id: string | null;
  summary: string | null;
  last_activity_at: string;
  deleted_at: string | null;
  is_demo: boolean;
  created_at: string;
  stage_info: { label: string; sort_order: number; default_probability: number; is_terminal: boolean; is_won: boolean } | null;
  country_info: { name: string; region: string } | null;
  owner: { id: string; full_name: string } | null;
  introducer: { id: string; name: string } | null;
  project_owner: { id: string; name: string } | null;
};

function toRow(v: ReturnType<typeof dealSchema.parse>) {
  return {
    name: v.name,
    country: v.country ?? null,
    sector: v.sector,
    ticket_minor: v.ticket == null ? null : toMinor(v.ticket, v.currency),
    currency: v.currency,
    probability: v.probability ?? null,
    project_owner_org_id: v.project_owner_org_id ?? null,
    introducer_org_id: v.introducer_org_id ?? null,
    fee_terms: v.fee_terms ?? null,
    spv_planned: v.spv_planned,
    next_step: v.next_step ?? null,
    next_step_due: v.next_step_due ?? null,
    expected_close_date: v.expected_close_date ?? null,
    owner_id: v.owner_id ?? null,
    summary: v.summary ?? null,
  };
}

export async function createDeal(db: Db, input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createDealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const { data, error } = await db.from("deals").insert({ ...toRow(parsed.data), stage: parsed.data.stage }).select("id").single();
  if (error) return fail(error);
  return ok({ id: data.id });
}

export async function updateDeal(db: Db, id: string, input: unknown): Promise<ActionResult> {
  const parsed = dealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const { data, error } = await db.from("deals").update(toRow(parsed.data)).eq("id", id).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("Deal not found or you can't edit it.");
  return ok(undefined);
}

export async function moveDealStage(db: Db, input: unknown): Promise<ActionResult> {
  const parsed = moveStageSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid stage move");
  const { error } = await db.rpc("move_deal_stage", { p_deal: parsed.data.dealId, p_stage: parsed.data.stage, p_note: parsed.data.note ?? undefined });
  return error ? fail(error) : ok(undefined);
}

export async function setDealArchived(db: Db, id: string, archived: boolean): Promise<ActionResult> {
  const { data, error } = await db.from("deals").update({ deleted_at: archived ? new Date().toISOString() : null }).eq("id", id).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("Deal not found or you can't change it.");
  return ok(undefined);
}

export async function addDealParty(db: Db, input: unknown): Promise<ActionResult> {
  const parsed = partySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid party");
  const { error } = await db.from("deal_parties").insert({ deal_id: parsed.data.dealId, organization_id: parsed.data.organizationId, role: parsed.data.role });
  return error ? fail(error) : ok(undefined);
}

export async function removeDealParty(db: Db, partyId: string): Promise<ActionResult> {
  const { data, error } = await db.from("deal_parties").delete().eq("id", partyId).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Only a manager or principal can remove a party.");
}

export async function addDealMember(db: Db, dealId: string, userId: string): Promise<ActionResult> {
  const { error } = await db.from("deal_members").insert({ deal_id: dealId, user_id: userId });
  return error ? fail(error) : ok(undefined);
}

export async function removeDealMember(db: Db, dealId: string, userId: string): Promise<ActionResult> {
  const { data, error } = await db.from("deal_members").delete().eq("deal_id", dealId).eq("user_id", userId).select("user_id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Only a manager or principal can remove a member.");
}

export async function matchInvestors(db: Db, dealId: string) {
  const { data, error } = await db.rpc("match_investors", { p_deal: dealId, p_limit: 8 });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function logIntroduction(db: Db, input: unknown): Promise<ActionResult<{ id: string; seq: number }>> {
  const parsed = introductionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  if (v.introduced_on > todayDubai()) return { ok: false, error: "An introduction can't be dated in the future.", fieldErrors: { introduced_on: "Can't be in the future" } };
  const { data, error } = await db
    .from("introductions")
    .insert({
      introduced_on: v.introduced_on,
      deal_id: v.deal_id ?? null,
      party_a_org_id: v.party_a_org_id,
      party_a_contact_id: v.party_a_contact_id ?? null,
      party_b_org_id: v.party_b_org_id,
      party_b_contact_id: v.party_b_contact_id ?? null,
      channel: v.channel,
      summary: v.summary,
      corrects_id: v.corrects_id ?? null,
      row_hash: "", // computed by the database trigger
    })
    .select("id, seq")
    .single();
  if (error) return fail(error);
  return ok({ id: data.id, seq: data.seq });
}

/** Weighted forecast by expected close month for the next 12 months. */
export function forecastByMonth(deals: DealRow[], today = todayDubai()) {
  const start = today.slice(0, 7);
  const months: { month: string; weighted: number; total: number; deals: number }[] = [];
  const [y, m] = start.split("-").map(Number);
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    months.push({ month: d.toISOString().slice(0, 7), weighted: 0, total: 0, deals: 0 });
  }
  let undated = 0;
  let overdue = 0;
  for (const d of deals) {
    if (d.is_terminal || d.value_usd == null) continue;
    if (!d.expected_close_date) {
      undated += d.weighted_usd ?? 0;
      continue;
    }
    const key = d.expected_close_date.slice(0, 7);
    const bucket = months.find((b) => b.month === key);
    if (key < start) overdue += d.weighted_usd ?? 0;
    else if (bucket) {
      bucket.weighted += d.weighted_usd ?? 0;
      bucket.total += d.value_usd;
      bucket.deals += 1;
    }
  }
  return { months, undated, overdue };
}
