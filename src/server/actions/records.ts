"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/dates";
import { formatMoney, toMajor } from "@/lib/money";
import { RECORD_TYPES, type RecordPreview, type SearchHit } from "@/server/records-shared";


const searchSchema = z.string().trim().min(2).max(120);

/** Cmd+K record search. Runs under the caller's JWT, so results are RLS-filtered. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  const q = searchSchema.safeParse(query);
  if (!q.success) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_everything", { p_query: q.data, p_limit: 12 });
  if (error || !data) return [];
  return data.map((r) => ({ entityType: r.entity_type, entityId: r.entity_id, title: r.title, subtitle: r.subtitle }));
}

const previewSchema = z.object({ type: z.enum(RECORD_TYPES), id: z.string().uuid() });

const title = (s: string | null | undefined) => (s ? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "");

/**
 * Read-only preview used by the record sheet until each module ships its full
 * record page. Returns null when the record doesn't exist or RLS hides it.
 */
export async function getRecordPreview(type: string, id: string): Promise<RecordPreview | null> {
  const parsed = previewSchema.safeParse({ type, id });
  if (!parsed.success) return null;
  const supabase = await createClient();

  switch (parsed.data.type) {
    case "deal": {
      const { data: d } = await supabase
        .from("deals")
        .select(
          "id, name, country, sector, ticket_minor, currency, stage, probability, fee_terms, spv_planned, next_step, next_step_due, summary, is_demo, " +
            "stage_info:pipeline_stages(label, default_probability), country_info:countries(name), owner:profiles!deals_owner_id_fkey(full_name), " +
            "project_owner:organizations!deals_project_owner_org_id_fkey(name), introducer:organizations!deals_introducer_org_id_fkey(name)",
        )
        .eq("id", id)
        .maybeSingle<DealRow>();
      if (!d) return null;
      const [{ data: history }, { data: parties }] = await Promise.all([
        supabase.from("deal_stage_history").select("to_stage, changed_at, stage:pipeline_stages!deal_stage_history_to_stage_fkey(label)").eq("deal_id", id).order("changed_at", { ascending: false }).limit(8),
        supabase.from("deal_parties").select("role, org:organizations(name)").eq("deal_id", id),
      ]);
      return {
        type: "deal",
        id,
        title: d.name,
        kicker: "Deal",
        badges: [
          { label: d.stage_info?.label ?? d.stage, tone: "gold" },
          { label: title(d.sector) },
          ...(d.is_demo ? [{ label: "Demo", tone: "warning" as const }] : []),
        ],
        fields: [
          { label: "Ticket", value: d.ticket_minor != null ? formatMoney(toMajor(d.ticket_minor, d.currency), d.currency) : "Not set" },
          { label: "Country", value: d.country_info?.name ?? "—" },
          { label: "Probability", value: `${d.probability ?? d.stage_info?.default_probability ?? 0}%` },
          { label: "Owner", value: d.owner?.full_name ?? "—" },
          { label: "Project owner", value: d.project_owner?.name ?? "—" },
          { label: "Introduced by", value: d.introducer?.name ?? "—" },
          { label: "Fee terms", value: d.fee_terms ?? "To be agreed" },
          { label: "SPV planned", value: d.spv_planned ? "Yes" : "No" },
          { label: "Next step", value: d.next_step ? `${d.next_step}${d.next_step_due ? ` (by ${fmtDate(d.next_step_due)})` : ""}` : "—" },
        ],
        notes: d.summary,
        lists: [
          { heading: "Parties", items: (parties ?? []).map((p) => `${(p.org as { name: string } | null)?.name ?? "?"} · ${title(p.role)}`) },
          {
            heading: "Stage history",
            items: (history ?? []).map((h) => `${(h.stage as { label: string } | null)?.label ?? h.to_stage} · ${fmtDate(h.changed_at.slice(0, 10))}`),
          },
        ],
        fullPagePhase: 2,
      };
    }
    case "organization": {
      const { data: o } = await supabase
        .from("organizations")
        .select("id, name, type, sectors, description, status, last_contact_at, is_demo, country_info:countries(name), owner:profiles!organizations_relationship_owner_id_fkey(full_name)")
        .eq("id", id)
        .maybeSingle();
      if (!o) return null;
      const { data: contacts } = await supabase.from("contacts").select("full_name, job_title").eq("organization_id", id).is("deleted_at", null);
      return {
        type: "organization",
        id,
        title: o.name,
        kicker: "Organization",
        badges: [{ label: title(o.type), tone: "gold" }, { label: title(o.status) }, ...(o.is_demo ? [{ label: "Demo", tone: "warning" as const }] : [])],
        fields: [
          { label: "Country", value: o.country_info?.name ?? "Multi-country" },
          { label: "Sectors", value: o.sectors.map(title).join(", ") || "—" },
          { label: "Relationship owner", value: o.owner?.full_name ?? "—" },
          { label: "Last contact", value: o.last_contact_at ? fmtDate(o.last_contact_at.slice(0, 10)) : "—" },
        ],
        notes: o.description,
        lists: [{ heading: "Contacts", items: (contacts ?? []).map((c) => c.full_name + (c.job_title ? ` · ${c.job_title}` : "")) }],
        fullPagePhase: 2,
      };
    }
    case "contact": {
      const { data: c } = await supabase.from("contacts").select("id, full_name, job_title, email, phone, notes, is_demo, org:organizations(name)").eq("id", id).maybeSingle();
      if (!c) return null;
      return {
        type: "contact",
        id,
        title: c.full_name,
        kicker: "Contact",
        badges: c.is_demo ? [{ label: "Demo", tone: "warning" }] : [],
        fields: [
          { label: "Organization", value: c.org?.name ?? "—" },
          { label: "Role", value: c.job_title ?? "—" },
          { label: "Email", value: c.email ?? "—" },
          { label: "Phone", value: c.phone ?? "—" },
        ],
        notes: c.notes,
        fullPagePhase: 2,
      };
    }
    case "task": {
      const { data: t } = await supabase
        .from("tasks")
        .select("id, title, description, status, priority, due_date, completed_at, is_demo, assignee:profiles!tasks_assignee_id_fkey(full_name), deal:deals(name), contract:contracts(title)")
        .eq("id", id)
        .maybeSingle();
      if (!t) return null;
      return {
        type: "task",
        id,
        title: t.title,
        kicker: "Task",
        badges: [
          { label: title(t.status), tone: t.status === "done" ? "success" : "default" },
          { label: title(t.priority), tone: t.priority === "urgent" || t.priority === "high" ? "danger" : "default" },
          ...(t.is_demo ? [{ label: "Demo", tone: "warning" as const }] : []),
        ],
        fields: [
          { label: "Due", value: t.due_date ? fmtDate(t.due_date) : "No due date" },
          { label: "Assignee", value: t.assignee?.full_name ?? "Unassigned" },
          { label: "Deal", value: t.deal?.name ?? "—" },
          { label: "Contract", value: t.contract?.title ?? "—" },
        ],
        notes: t.description,
        fullPagePhase: 2,
      };
    }
    case "contract": {
      const { data: k } = await supabase
        .from("contracts")
        .select(
          "id, title, contract_type, effective_date, term_months, end_date, renewal_type, notice_period_days, governing_law, forum, exclusivity, fee_terms, signatory_name, signatory_confirmed, signing_authority_confirmed, counterparty_address_confirmed, status, notes, is_demo, counterparty:organizations(name)",
        )
        .eq("id", id)
        .maybeSingle();
      if (!k) return null;
      const { data: survival } = await supabase.from("contract_survival_clauses").select("clause, survival_months").eq("contract_id", id);
      const flags = [
        !k.signing_authority_confirmed && "Signing authority not confirmed",
        !k.signatory_confirmed && "Signatory not confirmed",
        !k.counterparty_address_confirmed && "Address pending",
      ].filter(Boolean) as string[];
      return {
        type: "contract",
        id,
        title: k.title,
        kicker: "Contract",
        badges: [
          { label: title(k.status), tone: k.status === "active" ? "success" : "default" },
          ...flags.map((f) => ({ label: f, tone: "danger" as const })),
          ...(k.is_demo ? [{ label: "Demo", tone: "warning" as const }] : []),
        ],
        fields: [
          { label: "Counterparty", value: k.counterparty?.name ?? "—" },
          { label: "Type", value: title(k.contract_type) },
          { label: "Effective", value: fmtDate(k.effective_date) || "—" },
          { label: "Term", value: k.term_months ? `${k.term_months} months` : "—" },
          { label: "Current term ends", value: fmtDate(k.end_date) || "—" },
          {
            label: "Renewal",
            value: k.renewal_type === "auto_renew" ? `Auto-renews; ${k.notice_period_days ?? "?"}-day notice` : "Fixed term",
          },
          { label: "Governing law", value: k.governing_law ?? "—" },
          { label: "Forum", value: k.forum ?? "—" },
          { label: "Exclusivity", value: k.exclusivity ?? "—" },
          { label: "Fees", value: k.fee_terms ?? "—" },
          { label: "Signatory", value: k.signatory_name ?? "Not recorded" },
        ],
        notes: k.notes,
        lists: [{ heading: "Survival clauses", items: (survival ?? []).map((s) => `${s.clause} · ${s.survival_months} months after termination`) }],
        fullPagePhase: 3,
      };
    }
    case "document": {
      const { data: doc } = await supabase
        .from("documents")
        .select("id, title, doc_type, confidentiality, status, expiry_date, description, current_version_id, is_demo, folder:folders(name)")
        .eq("id", id)
        .maybeSingle();
      if (!doc) return null;
      return {
        type: "document",
        id,
        title: doc.title,
        kicker: "Document",
        badges: [
          { label: title(doc.status), tone: doc.status === "awaiting_signature" ? "warning" : "default" },
          { label: title(doc.confidentiality), tone: doc.confidentiality === "restricted" || doc.confidentiality === "confidential" ? "danger" : "default" },
          ...(doc.current_version_id ? [] : [{ label: "File not uploaded", tone: "info" as const }]),
          ...(doc.is_demo ? [{ label: "Demo", tone: "warning" as const }] : []),
        ],
        fields: [
          { label: "Type", value: title(doc.doc_type) },
          { label: "Folder", value: doc.folder?.name ?? "—" },
          { label: "Expiry", value: fmtDate(doc.expiry_date) || "—" },
        ],
        notes: doc.description,
        fullPagePhase: 3,
      };
    }
    case "compliance_item": {
      const { data: c } = await supabase
        .from("compliance_items")
        .select("id, title, category, authority, due_date, recurrence, status, notes, is_demo, owner:profiles!compliance_items_owner_id_fkey(full_name)")
        .eq("id", id)
        .maybeSingle();
      if (!c) return null;
      return {
        type: "compliance_item",
        id,
        title: c.title,
        kicker: "Compliance",
        badges: [
          { label: title(c.status), tone: c.status === "unconfirmed" ? "info" : "default" },
          ...(c.is_demo ? [{ label: "Demo", tone: "warning" as const }] : []),
        ],
        fields: [
          { label: "Authority", value: c.authority ?? "—" },
          { label: "Category", value: title(c.category) },
          { label: "Due", value: fmtDate(c.due_date) || "Date not set" },
          { label: "Owner", value: c.owner?.full_name ?? "—" },
        ],
        notes: c.notes,
        fullPagePhase: 5,
      };
    }
    case "invoice": {
      const { data: i } = await supabase
        .from("invoices")
        .select("id, invoice_no, kind, issue_date, due_date, currency, total_minor, status, paid_at, is_demo, org:organizations(name), deal:deals(name)")
        .eq("id", id)
        .maybeSingle();
      if (!i) return null;
      return {
        type: "invoice",
        id,
        title: `Invoice ${i.invoice_no}`,
        kicker: "Invoice",
        badges: [{ label: title(i.status), tone: i.status === "paid" ? "success" : "default" }, ...(i.is_demo ? [{ label: "Demo", tone: "warning" as const }] : [])],
        fields: [
          { label: "Client", value: i.org?.name ?? "—" },
          { label: "Amount", value: formatMoney(toMajor(i.total_minor, i.currency), i.currency) },
          { label: "Issued", value: fmtDate(i.issue_date) },
          { label: "Due", value: fmtDate(i.due_date) },
          { label: "Deal", value: i.deal?.name ?? "—" },
        ],
        fullPagePhase: 5,
      };
    }
  }
}

type DealRow = {
  id: string;
  name: string;
  country: string | null;
  sector: string;
  ticket_minor: number | null;
  currency: string;
  stage: string;
  probability: number | null;
  fee_terms: string | null;
  spv_planned: boolean;
  next_step: string | null;
  next_step_due: string | null;
  summary: string | null;
  is_demo: boolean;
  stage_info: { label: string; default_probability: number } | null;
  country_info: { name: string } | null;
  owner: { full_name: string } | null;
  project_owner: { name: string } | null;
  introducer: { name: string } | null;
};
