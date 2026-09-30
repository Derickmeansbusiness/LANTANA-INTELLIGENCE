import "server-only";
import type { Db } from "@/lib/supabase/server";
import { fail, fieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { contractSchema, obligationSchema, survivalSchema } from "@/lib/schemas/contracts";
import { keyDates } from "@/lib/contract-dates";
import { todayDubai } from "@/lib/dates";

/** Contracts register. Managers and principals only: RLS returns nothing to staff. */

export type ContractRow = {
  id: string;
  title: string;
  contract_type: string;
  status: string;
  counterparty_id: string | null;
  counterparty: string | null;
  owner: string | null;
  effective_date: string | null;
  end_date: string | null;
  renewal_type: string;
  notice_period_days: number | null;
  next_date: string | null;
  next_label: string | null;
  days_left: number | null;
  flags: string[];
  esign_status: string | null;
  is_demo: boolean;
};

export function contractFlags(k: {
  signatory_confirmed: boolean;
  signing_authority_confirmed: boolean;
  counterparty_address_confirmed: boolean;
  forum: string | null;
  document_id: string | null;
  status: string;
}) {
  const f: string[] = [];
  if (!k.signing_authority_confirmed) f.push("Signing authority not confirmed");
  if (!k.signatory_confirmed) f.push("Signatory not confirmed");
  if (!k.counterparty_address_confirmed) f.push("Counterparty address pending");
  // Dubai Decree No. 34 of 2021 abolished the DIFC-LCIA centre; cases moved to DIAC.
  if (k.forum && /difc[\s-]*lcia/i.test(k.forum)) f.push("Forum names DIFC-LCIA, abolished in 2021");
  if (!k.document_id && ["active", "awaiting_signature"].includes(k.status)) f.push("No signed copy in the vault");
  return f;
}

const LIST_COLS =
  "id, title, contract_type, status, counterparty_org_id, effective_date, end_date, renewal_type, notice_period_days, forum, document_id, " +
  "signatory_confirmed, signing_authority_confirmed, counterparty_address_confirmed, esign_status, is_demo, " +
  "org:organizations(name), owner:profiles!contracts_owner_id_fkey(full_name), survival:contract_survival_clauses(clause, survival_months)";

type RawContract = {
  id: string;
  title: string;
  contract_type: string;
  status: string;
  counterparty_org_id: string | null;
  effective_date: string | null;
  end_date: string | null;
  renewal_type: string;
  notice_period_days: number | null;
  forum: string | null;
  document_id: string | null;
  signatory_confirmed: boolean;
  signing_authority_confirmed: boolean;
  counterparty_address_confirmed: boolean;
  esign_status: string | null;
  is_demo: boolean;
  org: { name: string } | null;
  owner: { full_name: string } | null;
  survival: { clause: string; survival_months: number }[];
};

export async function listContracts(db: Db): Promise<ContractRow[]> {
  const { data, error } = await db.from("contracts").select(LIST_COLS).is("deleted_at", null).order("end_date", { ascending: true, nullsFirst: false }).returns<RawContract[]>();
  if (error) throw new Error(error.message);
  const today = todayDubai();
  return (data ?? []).map((k) => {
    const next = ["active", "awaiting_signature", "negotiating"].includes(k.status) ? keyDates(k, k.survival, today).find((d) => d.daysLeft >= 0) : undefined;
    return {
      id: k.id,
      title: k.title,
      contract_type: k.contract_type,
      status: k.status,
      counterparty_id: k.counterparty_org_id,
      counterparty: k.org?.name ?? null,
      owner: k.owner?.full_name ?? null,
      effective_date: k.effective_date,
      end_date: k.end_date,
      renewal_type: k.renewal_type,
      notice_period_days: k.notice_period_days,
      next_date: next?.date ?? null,
      next_label: next?.label ?? null,
      days_left: next?.daysLeft ?? null,
      flags: contractFlags(k),
      esign_status: k.esign_status,
      is_demo: k.is_demo,
    };
  });
}

export async function getContract(db: Db, id: string) {
  const { data: k } = await db
    .from("contracts")
    .select("*, org:organizations(id, name), owner:profiles!contracts_owner_id_fkey(id, full_name), document:documents(id, title, status)")
    .eq("id", id)
    .maybeSingle();
  if (!k) return null;
  const [survival, obligations, alerts, docs] = await Promise.all([
    db.from("contract_survival_clauses").select("id, clause, survival_months, created_at").eq("contract_id", id).order("created_at"),
    db
      .from("contract_obligations")
      .select("id, description, due_date, status, task_id, owner:profiles!contract_obligations_owner_id_fkey(full_name), task:tasks!contract_obligations_task_id_fkey(id, status)")
      .eq("contract_id", id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    db.from("alerts_sent").select("kind, threshold_days, target_date, sent_at").eq("entity_id", id).order("sent_at", { ascending: false }).limit(50),
    db.from("document_links").select("document:documents(id, title, doc_type, status, deleted_at)").eq("entity_type", "contract").eq("entity_id", id),
  ]);
  const today = todayDubai();
  return {
    k,
    survival: survival.data ?? [],
    obligations: obligations.data ?? [],
    alerts: alerts.data ?? [],
    linkedDocs: (docs.data ?? []).map((d) => d.document).filter((d): d is NonNullable<typeof d> => Boolean(d) && !d!.deleted_at),
    dates: keyDates(k, survival.data ?? [], today),
    flags: contractFlags(k),
    today,
  };
}

function clean(p: ReturnType<typeof contractSchema.parse>) {
  return {
    ...p,
    counterparty_org_id: p.counterparty_org_id ?? null,
    document_id: p.document_id ?? null,
    owner_id: p.owner_id ?? null,
    effective_date: p.effective_date ?? null,
    end_date: p.end_date ?? null,
    term_months: p.term_months ?? null,
    notice_period_days: p.notice_period_days ?? null,
    governing_law: p.governing_law ?? null,
    forum: p.forum ?? null,
    exclusivity: p.exclusivity ?? null,
    fee_terms: p.fee_terms ?? null,
    signatory_name: p.signatory_name ?? null,
    esign_status: p.esign_status ?? null,
    notes: p.notes ?? null,
  };
}

export async function createContract(db: Db, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = contractSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  // Default owner is whoever adds it, so alerts and obligation tasks always reach someone.
  const { data: claims } = await db.auth.getClaims();
  const row = clean(p.data);
  const { data, error } = await db
    .from("contracts")
    .insert({ ...row, owner_id: row.owner_id ?? claims?.claims?.sub ?? null })
    .select("id")
    .single();
  if (error) return fail(error.code === "42501" ? "Only a manager or principal can add contracts." : error);
  return ok({ id: data.id });
}

export async function updateContract(db: Db, id: string, input: unknown): Promise<ActionResult> {
  const p = contractSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data, error } = await db.from("contracts").update(clean(p.data)).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Contract not found or you can't edit it.");
}

export async function setContractArchived(db: Db, id: string, archived: boolean): Promise<ActionResult> {
  const { data, error } = await db.from("contracts").update({ deleted_at: archived ? new Date().toISOString() : null }).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Contract not found.");
}

export async function addSurvival(db: Db, input: unknown): Promise<ActionResult> {
  const p = survivalSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { error } = await db.from("contract_survival_clauses").insert(p.data);
  return error ? fail(error) : ok(undefined);
}

export async function removeSurvival(db: Db, id: string): Promise<ActionResult> {
  const { data, error } = await db.from("contract_survival_clauses").delete().eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Clause not found.");
}

/** A dated obligation also becomes a high-priority task (database trigger obligations_to_task). */
export async function addObligation(db: Db, input: unknown): Promise<ActionResult<{ taskId: string | null }>> {
  const p = obligationSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data, error } = await db
    .from("contract_obligations")
    .insert({ ...p.data, due_date: p.data.due_date ?? null, owner_id: p.data.owner_id ?? null })
    .select("task_id")
    .single();
  if (error) return fail(error);
  return ok({ taskId: data.task_id });
}

export async function setObligationStatus(db: Db, id: string, status: "open" | "done" | "waived"): Promise<ActionResult> {
  const { data, error } = await db.from("contract_obligations").update({ status }).eq("id", id).select("id, task_id");
  if (error) return fail(error);
  if (!data?.length) return fail("Obligation not found.");
  // Keep the linked task in step so it drops off (or returns to) people's lists.
  const taskId = data[0].task_id;
  if (taskId) {
    const { error: tErr } = await db.from("tasks").update({ status: status === "open" ? "todo" : status === "waived" ? "cancelled" : "done" }).eq("id", taskId);
    if (tErr) return fail(`Obligation updated, but its task couldn't be: ${tErr.message}`);
  }
  return ok(undefined);
}

export async function runAlertsNow(db: Db): Promise<ActionResult<{ sent: number }>> {
  const { data, error } = await db.rpc("run_expiry_alerts_now");
  if (error) return fail(error.code === "42501" ? "Only a manager or principal can run alerts." : error);
  return ok({ sent: data ?? 0 });
}
