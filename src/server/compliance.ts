import "server-only";
import type { Db } from "@/lib/supabase/server";
import { fail, fieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { todayDubai } from "@/lib/dates";
import { meetingSchema, obligationSchema, recordSchema, resolutionSchema } from "@/lib/schemas/compliance";

/**
 * Compliance and governance. All of it is manager+ (RLS). Only a principal
 * can confirm that an obligation applies (database trigger); until then it
 * only appears as "confirm whether this applies" and drives no alerts.
 */

export type ObligationRow = {
  id: string;
  title: string;
  category: string;
  authority: string | null;
  due_date: string | null;
  recurrence: string | null;
  status: string;
  owner_id: string | null;
  owner: string | null;
  document_id: string | null;
  notes: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  completed_on: string | null;
  is_demo: boolean;
};

export async function listObligations(db: Db): Promise<ObligationRow[]> {
  const { data } = await db
    .from("compliance_items")
    .select(
      "id, title, category, authority, due_date, recurrence, status, owner_id, document_id, notes, confirmed_at, completed_on, is_demo, " +
        "owner:profiles!compliance_items_owner_id_fkey(full_name), confirmer:profiles!compliance_items_confirmed_by_fkey(full_name)",
    )
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .returns<(Omit<ObligationRow, "owner" | "confirmed_by"> & { owner: { full_name: string } | null; confirmer: { full_name: string } | null })[]>();
  return (data ?? []).map((r) => ({ ...r, owner: r.owner?.full_name ?? null, confirmed_by: r.confirmer?.full_name ?? null }));
}

export async function saveObligation(db: Db, id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = obligationSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const q = id ? db.from("compliance_items").update(p.data).eq("id", id).select("id").single() : db.from("compliance_items").insert(p.data).select("id").single();
  const { data, error } = await q;
  return error ? fail(error) : ok({ id: data.id });
}

export async function setObligationStatus(db: Db, id: string, status: string): Promise<ActionResult> {
  const { data: row } = await db.from("compliance_items").select("due_date").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "Obligation not found." };
  if (["upcoming", "in_progress"].includes(status) && !row.due_date) return { ok: false, error: "Set the due date first (Edit)." };
  const { error } = await db.from("compliance_items").update({ status }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}

export async function archiveObligation(db: Db, id: string): Promise<ActionResult> {
  const { error } = await db.from("compliance_items").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}

// ---------------------------------------------------------------- corporate records

export type RecordRow = {
  id: string;
  kind: string;
  title: string;
  reference_no: string | null;
  authority: string | null;
  holder: string | null;
  detail: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  document_id: string | null;
  document: string | null;
  notes: string | null;
  is_demo: boolean;
};

export async function listRecords(db: Db): Promise<RecordRow[]> {
  const { data } = await db
    .from("corporate_records")
    .select("id, kind, title, reference_no, authority, holder, detail, issue_date, expiry_date, document_id, notes, is_demo, doc:documents(title)")
    .is("deleted_at", null)
    .order("kind")
    .order("title")
    .returns<(Omit<RecordRow, "document"> & { doc: { title: string } | null })[]>();
  return (data ?? []).map((r) => ({ ...r, document: r.doc?.title ?? null }));
}

export async function saveRecord(db: Db, id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = recordSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data, error } = id
    ? await db.from("corporate_records").update(p.data).eq("id", id).select("id").single()
    : await db.from("corporate_records").insert(p.data).select("id").single();
  return error ? fail(error) : ok({ id: data.id });
}

export async function archiveRecord(db: Db, id: string): Promise<ActionResult> {
  const { error } = await db.from("corporate_records").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}

// ---------------------------------------------------------------- meetings & resolutions

export type GovMeeting = {
  id: string;
  title: string;
  kind: string;
  starts_at: string;
  location: string | null;
  notes: string | null;
  minutes: string | null;
  minutes_approved_at: string | null;
  attendee_ids: string[];
  is_demo: boolean;
  resolutions: { id: string; ref_no: string | null; title: string; body: string | null; kind: string; status: string; passed_on: string | null; document_id: string | null }[];
};

export async function listGovernance(db: Db) {
  const [meetings, loose] = await Promise.all([
    db
      .from("meetings")
      .select("id, title, kind, starts_at, location, notes, minutes, minutes_approved_at, attendee_ids, is_demo, resolutions(id, ref_no, title, body, kind, status, passed_on, document_id, deleted_at)")
      .in("kind", ["board", "shareholders", "management"])
      .is("deleted_at", null)
      .order("starts_at", { ascending: false })
      .returns<(Omit<GovMeeting, "resolutions"> & { resolutions: (GovMeeting["resolutions"][number] & { deleted_at: string | null })[] })[]>(),
    db
      .from("resolutions")
      .select("id, ref_no, title, body, kind, status, passed_on, document_id")
      .is("meeting_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  return {
    meetings: (meetings.data ?? []).map((m) => ({ ...m, resolutions: m.resolutions.filter((r) => !r.deleted_at) })) as GovMeeting[],
    written: (loose.data ?? []) as GovMeeting["resolutions"],
  };
}

export async function saveMeeting(db: Db, id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = meetingSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  // datetime-local has no zone; meetings are in Dubai time.
  const startsAt = /T\d{2}:\d{2}$/.test(p.data.starts_at) ? `${p.data.starts_at}:00+04:00` : p.data.starts_at;
  const row = { ...p.data, starts_at: startsAt };
  const { data, error } = id ? await db.from("meetings").update(row).eq("id", id).select("id").single() : await db.from("meetings").insert(row).select("id").single();
  return error ? fail(error) : ok({ id: data.id });
}

export async function approveMinutes(db: Db, id: string): Promise<ActionResult> {
  const { data: m } = await db.from("meetings").select("minutes").eq("id", id).maybeSingle();
  if (!m?.minutes?.trim()) return { ok: false, error: "Write the minutes first." };
  const { error } = await db.from("meetings").update({ minutes_approved_at: new Date().toISOString() }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}

export async function saveResolution(db: Db, id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = resolutionSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data, error } = id
    ? await db.from("resolutions").update(p.data).eq("id", id).select("id").single()
    : await db.from("resolutions").insert(p.data).select("id").single();
  return error ? fail(error) : ok({ id: data.id });
}

/** What the agent and the briefing need: upcoming confirmed deadlines and unconfirmed items. */
export async function complianceSummary(db: Db) {
  const today = todayDubai();
  const rows = await listObligations(db);
  return {
    unconfirmed: rows.filter((r) => r.status === "unconfirmed").map((r) => ({ id: r.id, title: r.title, authority: r.authority })),
    upcoming: rows
      .filter((r) => ["upcoming", "in_progress"].includes(r.status) && r.due_date)
      .map((r) => ({ id: r.id, title: r.title, due_date: r.due_date, status: r.status, overdue: r.due_date! < today, owner: r.owner })),
  };
}
