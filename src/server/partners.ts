import "server-only";
import type { Db } from "@/lib/supabase/server";
import { toMajor } from "@/lib/money";

export type OrgRow = {
  id: string;
  name: string;
  type: string;
  country: string | null;
  country_name: string | null;
  regions_of_interest: string[];
  sectors: string[];
  ticket_min: number | null;
  ticket_max: number | null;
  ticket_currency: string | null;
  owner_name: string | null;
  status: string;
  last_contact_at: string | null;
  deal_count: number;
  contact_count: number;
  is_demo: boolean;
};

export async function listOrganizations(db: Db): Promise<OrgRow[]> {
  const [orgs, deals, parties] = await Promise.all([
    db
      .from("organizations")
      .select("id, name, type, country, regions_of_interest, sectors, ticket_min_minor, ticket_max_minor, ticket_currency, status, last_contact_at, is_demo, country_info:countries(name), owner:profiles!organizations_relationship_owner_id_fkey(full_name), contacts(id, deleted_at)")
      .is("deleted_at", null)
      .order("name"),
    db.from("deals").select("id, project_owner_org_id, introducer_org_id").is("deleted_at", null),
    db.from("deal_parties").select("deal_id, organization_id"),
  ]);
  if (orgs.error) throw new Error(orgs.error.message);
  const dealsByOrg = new Map<string, Set<string>>();
  const add = (org: string | null, deal: string) => {
    if (!org) return;
    if (!dealsByOrg.has(org)) dealsByOrg.set(org, new Set());
    dealsByOrg.get(org)!.add(deal);
  };
  for (const d of deals.data ?? []) {
    add(d.project_owner_org_id, d.id);
    add(d.introducer_org_id, d.id);
  }
  const liveDeals = new Set((deals.data ?? []).map((d) => d.id));
  for (const p of parties.data ?? []) if (liveDeals.has(p.deal_id)) add(p.organization_id, p.deal_id);

  return (orgs.data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    type: o.type,
    country: o.country,
    country_name: o.country_info?.name ?? null,
    regions_of_interest: o.regions_of_interest,
    sectors: o.sectors,
    ticket_min: o.ticket_min_minor == null || !o.ticket_currency ? null : toMajor(o.ticket_min_minor, o.ticket_currency),
    ticket_max: o.ticket_max_minor == null || !o.ticket_currency ? null : toMajor(o.ticket_max_minor, o.ticket_currency),
    ticket_currency: o.ticket_currency,
    owner_name: o.owner?.full_name ?? null,
    status: o.status,
    last_contact_at: o.last_contact_at,
    deal_count: dealsByOrg.get(o.id)?.size ?? 0,
    contact_count: (o.contacts ?? []).filter((c) => !c.deleted_at).length,
    is_demo: o.is_demo,
  }));
}

export type ContactRow = {
  id: string;
  full_name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  organization_id: string | null;
  organization_name: string | null;
  country: string | null;
  notes: string | null;
  is_demo: boolean;
};

export async function listContacts(db: Db): Promise<ContactRow[]> {
  const { data, error } = await db
    .from("contacts")
    .select("id, full_name, job_title, email, phone, organization_id, country, notes, is_demo, org:organizations(name)")
    .is("deleted_at", null)
    .order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ ...c, organization_name: c.org?.name ?? null, org: undefined }) as ContactRow);
}

export async function getOrganization(db: Db, id: string) {
  const { data: org } = await db
    .from("organizations")
    .select("*, country_info:countries(name), owner:profiles!organizations_relationship_owner_id_fkey(id, full_name), linked:profiles!organizations_linked_profile_id_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!org) return null;

  const [contacts, ownedDeals, introducedDeals, partyDeals, contracts, interactions, notes, intros, docs] = await Promise.all([
    db.from("contacts").select("id, full_name, job_title, email, phone, country, notes").eq("organization_id", id).is("deleted_at", null).order("full_name"),
    db.from("deals").select("id, name, stage, stage_info:pipeline_stages(label)").eq("project_owner_org_id", id).is("deleted_at", null),
    db.from("deals").select("id, name, stage, stage_info:pipeline_stages(label)").eq("introducer_org_id", id).is("deleted_at", null),
    db.from("deal_parties").select("role, deal:deals(id, name, stage, deleted_at, stage_info:pipeline_stages(label))").eq("organization_id", id),
    db
      .from("contracts")
      .select("id, title, contract_type, status, effective_date, end_date, renewal_type, notice_period_days, governing_law, forum, signing_authority_confirmed, signatory_confirmed, counterparty_address_confirmed, survival:contract_survival_clauses(clause, survival_months)")
      .eq("counterparty_org_id", id)
      .is("deleted_at", null)
      .order("effective_date", { ascending: false }),
    db.from("interactions").select("id, kind, occurred_on, summary, contact:contacts(full_name), deal:deals(id, name), author:profiles!interactions_created_by_fkey(full_name)").eq("organization_id", id).is("deleted_at", null).order("occurred_on", { ascending: false }),
    db.from("notes").select("id, body, pinned, created_at, author:profiles!notes_created_by_fkey(full_name)").eq("entity_type", "organization").eq("entity_id", id).is("deleted_at", null).order("pinned", { ascending: false }).order("created_at", { ascending: false }),
    db
      .from("introductions")
      .select("id, seq, introduced_on, channel, summary, a:organizations!introductions_party_a_org_id_fkey(id, name), b:organizations!introductions_party_b_org_id_fkey(id, name)")
      .or(`party_a_org_id.eq.${id},party_b_org_id.eq.${id}`)
      .order("seq", { ascending: false }),
    db.from("document_links").select("document:documents(id, title, status, doc_type)").eq("entity_type", "organization").eq("entity_id", id),
  ]);

  type DealLite = { id: string; name: string; stage: string; label: string; role: string };
  const deals = new Map<string, DealLite>();
  for (const d of ownedDeals.data ?? []) deals.set(d.id, { id: d.id, name: d.name, stage: d.stage, label: d.stage_info?.label ?? d.stage, role: "Project owner" });
  for (const d of introducedDeals.data ?? []) deals.set(d.id, { id: d.id, name: d.name, stage: d.stage, label: d.stage_info?.label ?? d.stage, role: "Introducer" });
  for (const p of partyDeals.data ?? []) {
    const d = p.deal;
    if (d && !d.deleted_at) deals.set(d.id, { id: d.id, name: d.name, stage: d.stage, label: d.stage_info?.label ?? d.stage, role: p.role.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) });
  }

  return {
    org,
    contacts: contacts.data ?? [],
    deals: [...deals.values()],
    contracts: contracts.data ?? [],
    interactions: interactions.data ?? [],
    notes: notes.data ?? [],
    introductions: intros.data ?? [],
    documents: (docs.data ?? []).map((d) => d.document).filter(Boolean),
  };
}
