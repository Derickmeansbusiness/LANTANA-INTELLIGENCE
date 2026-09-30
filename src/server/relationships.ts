import "server-only";
import type { Db } from "@/lib/supabase/server";
import { fail, fieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { contactSchema, interactionSchema, noteSchema, orgSchema } from "@/lib/schemas/relationships";
import { toMinor } from "@/lib/money";
import { todayDubai } from "@/lib/dates";

/** Notes, interactions, organizations and contacts. RLS-bound like everything else. */

export async function addNote(db: Db, input: unknown): Promise<ActionResult> {
  const p = noteSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Invalid note");
  const { data: claims } = await db.auth.getClaims();
  const { error } = await db.from("notes").insert({
    entity_type: p.data.entityType,
    entity_id: p.data.entityId,
    body: p.data.body,
    pinned: p.data.pinned,
    created_by: claims?.claims?.sub,
  });
  return error ? fail(error) : ok(undefined);
}

export async function updateNote(db: Db, id: string, patch: { pinned?: boolean; archived?: boolean }): Promise<ActionResult> {
  const upd: { pinned?: boolean; deleted_at?: string | null } = {};
  if (patch.pinned !== undefined) upd.pinned = patch.pinned;
  if (patch.archived !== undefined) upd.deleted_at = patch.archived ? new Date().toISOString() : null;
  const { data, error } = await db.from("notes").update(upd).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("You can only change your own notes.");
}

export async function logInteraction(db: Db, input: unknown): Promise<ActionResult> {
  const p = interactionSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  if (p.data.occurred_on > todayDubai()) return { ok: false, error: "That date is in the future.", fieldErrors: { occurred_on: "Can't be in the future" } };
  const { error } = await db.from("interactions").insert({
    organization_id: p.data.organization_id ?? null,
    contact_id: p.data.contact_id ?? null,
    deal_id: p.data.deal_id ?? null,
    kind: p.data.kind,
    occurred_on: p.data.occurred_on,
    summary: p.data.summary,
  });
  return error ? fail(error) : ok(undefined);
}

function orgRow(v: ReturnType<typeof orgSchema.parse>) {
  return {
    name: v.name,
    type: v.type,
    country: v.country ?? null,
    regions_of_interest: v.regions_of_interest,
    sectors: v.sectors,
    ticket_min_minor: v.ticket_min == null ? null : toMinor(v.ticket_min, v.ticket_currency),
    ticket_max_minor: v.ticket_max == null ? null : toMinor(v.ticket_max, v.ticket_currency),
    ticket_currency: v.ticket_min == null && v.ticket_max == null ? null : v.ticket_currency,
    website: v.website ?? null,
    description: v.description ?? null,
    relationship_owner_id: v.relationship_owner_id ?? null,
    status: v.status,
  };
}

export async function createOrganization(db: Db, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = orgSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data: dupe } = await db.from("organizations").select("id").ilike("name", p.data.name).is("deleted_at", null).limit(1);
  if (dupe?.length) return { ok: false, error: "An organization with that name already exists.", fieldErrors: { name: "Already exists" } };
  const { data, error } = await db.from("organizations").insert(orgRow(p.data)).select("id").single();
  return error ? fail(error) : ok({ id: data.id });
}

export async function updateOrganization(db: Db, id: string, input: unknown): Promise<ActionResult> {
  const p = orgSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data, error } = await db.from("organizations").update(orgRow(p.data)).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Organization not found or you can't edit it.");
}

export async function setOrganizationArchived(db: Db, id: string, archived: boolean): Promise<ActionResult> {
  const { data, error } = await db.from("organizations").update({ deleted_at: archived ? new Date().toISOString() : null }).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Organization not found or you can't change it.");
}

export async function createContact(db: Db, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = contactSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data, error } = await db
    .from("contacts")
    .insert({
      organization_id: p.data.organization_id ?? null,
      full_name: p.data.full_name,
      job_title: p.data.job_title ?? null,
      email: p.data.email ?? null,
      phone: p.data.phone ?? null,
      country: p.data.country ?? null,
      notes: p.data.notes ?? null,
    })
    .select("id")
    .single();
  return error ? fail(error) : ok({ id: data.id });
}

export async function updateContact(db: Db, id: string, input: unknown): Promise<ActionResult> {
  const p = contactSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data, error } = await db
    .from("contacts")
    .update({
      organization_id: p.data.organization_id ?? null,
      full_name: p.data.full_name,
      job_title: p.data.job_title ?? null,
      email: p.data.email ?? null,
      phone: p.data.phone ?? null,
      country: p.data.country ?? null,
      notes: p.data.notes ?? null,
    })
    .eq("id", id)
    .select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Contact not found or you can't edit it.");
}
