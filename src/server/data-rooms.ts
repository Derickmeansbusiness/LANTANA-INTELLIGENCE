import "server-only";
import type { Db } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { shiftDate, todayDubai } from "@/lib/dates";

/**
 * External data rooms. Managers and principals run them; guests (role
 * external) see only rooms they belong to, through the portal. Every rule is
 * in the database (RLS, guards, open_room_document); this module only shapes
 * input and output.
 */

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID = /^[0-9a-f-]{36}$/i;

export type RoomRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  expires_on: string | null;
  allow_download: boolean;
  deal: { id: string; name: string } | null;
  org: { id: string; name: string } | null;
  members: number;
  documents: number;
  last_activity: string | null;
  is_demo: boolean;
};

export async function listRooms(db: Db): Promise<RoomRow[]> {
  const { data } = await db
    .from("data_rooms")
    .select(
      "id, name, description, status, expires_on, allow_download, is_demo, deal:deals(id, name), org:organizations(id, name), " +
        "members:data_room_members(revoked_at), docs:data_room_documents(document_id), events:data_room_events(occurred_at)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<
      (Omit<RoomRow, "members" | "documents" | "last_activity"> & { members: { revoked_at: string | null }[]; docs: unknown[]; events: { occurred_at: string }[] })[]
    >();
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status,
    expires_on: r.expires_on,
    allow_download: r.allow_download,
    deal: r.deal,
    org: r.org,
    members: r.members.filter((m) => !m.revoked_at).length,
    documents: r.docs.length,
    last_activity: r.events.map((e) => e.occurred_at).sort().at(-1) ?? null,
    is_demo: r.is_demo,
  }));
}

/** Room effectively open today (status, expiry). Mirrors private.room_open(). */
export function roomIsOpen(r: { status: string; expires_on: string | null }, today = todayDubai()) {
  return r.status === "open" && (!r.expires_on || r.expires_on >= today);
}

export async function getRoom(db: Db, id: string) {
  if (!UUID.test(id)) return null;
  const { data: room } = await db
    .from("data_rooms")
    .select("id, name, description, status, expires_on, allow_download, deal_id, organization_id, is_demo, created_at, deal:deals(id, name), org:organizations(id, name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      name: string;
      description: string | null;
      status: string;
      expires_on: string | null;
      allow_download: boolean;
      deal_id: string | null;
      organization_id: string | null;
      is_demo: boolean;
      created_at: string;
      deal: { id: string; name: string } | null;
      org: { id: string; name: string } | null;
    }>();
  if (!room) return null;
  const [members, docs, events] = await Promise.all([
    db.from("data_room_members").select("id, email, full_name, company, profile_id, created_at, revoked_at").eq("room_id", id).order("created_at"),
    db.rpc("portal_room_documents", { p_room: id }),
    db
      .from("data_room_events")
      .select("id, kind, occurred_at, document:documents(title), who:profiles!data_room_events_profile_id_fkey(full_name, email)")
      .eq("room_id", id)
      .order("occurred_at", { ascending: false })
      .limit(100)
      .returns<{ id: number; kind: string; occurred_at: string; document: { title: string } | null; who: { full_name: string; email: string } | null }[]>(),
  ]);
  return { room, members: members.data ?? [], documents: docs.data ?? [], events: events.data ?? [] };
}

type RoomInput = { name?: unknown; description?: unknown; deal_id?: unknown; organization_id?: unknown; expires_on?: unknown; allow_download?: unknown; status?: unknown };

type RoomFields = { name: string; description: string | null; deal_id: string | null; organization_id: string | null; expires_on: string | null; allow_download: boolean; status: string };

function roomRow(input: RoomInput): { row?: RoomFields; errors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 200) : "";
  if (name.length < 2) errors.name = "Name the room";
  const id = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
  const expires = typeof input.expires_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.expires_on) ? input.expires_on : null;
  if (typeof input.expires_on === "string" && input.expires_on && !expires) errors.expires_on = "Use a date";
  const status = input.status === "closed" ? "closed" : "open";
  if (Object.keys(errors).length) return { errors };
  return {
    row: {
      name,
      description: typeof input.description === "string" && input.description.trim() ? input.description.trim().slice(0, 2000) : null,
      deal_id: id(input.deal_id),
      organization_id: id(input.organization_id),
      expires_on: expires,
      allow_download: input.allow_download === true,
      status,
    },
  };
}

export async function saveRoom(db: Db, id: string | null, input: RoomInput): Promise<ActionResult<{ id: string }>> {
  const { row, errors } = roomRow(input);
  if (!row) return { ok: false, error: "Check the highlighted fields.", fieldErrors: errors };
  if (!id && !row.expires_on) row.expires_on = shiftDate(todayDubai(), 90);
  const { data, error } = id ? await db.from("data_rooms").update(row).eq("id", id).select("id").single() : await db.from("data_rooms").insert(row).select("id").single();
  return error ? fail(error) : ok({ id: data.id });
}

export async function archiveRoom(db: Db, id: string): Promise<ActionResult> {
  const { error } = await db.from("data_rooms").update({ deleted_at: new Date().toISOString(), status: "closed" }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}

export async function addMember(db: Db, roomId: string, input: { email?: unknown; full_name?: unknown; company?: unknown }): Promise<ActionResult> {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email)) return { ok: false, error: "Check the email address.", fieldErrors: { email: "Enter a valid email" } };
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
  const { data: existing } = await db.from("data_room_members").select("id, revoked_at").eq("room_id", roomId).eq("email", email).maybeSingle();
  if (existing && !existing.revoked_at) return { ok: false, error: "Already a guest in this room.", fieldErrors: { email: "Already invited" } };
  const { error } = existing
    ? await db.from("data_room_members").update({ revoked_at: null, full_name: str(input.full_name), company: str(input.company) }).eq("id", existing.id)
    : await db.from("data_room_members").insert({ room_id: roomId, email, full_name: str(input.full_name), company: str(input.company) });
  if (error?.code === "22023") return { ok: false, error: "That address belongs to a colleague, who already sees rooms from inside the app.", fieldErrors: { email: "A colleague's address" } };
  return error ? fail(error) : ok(undefined);
}

export async function revokeMember(db: Db, memberId: string): Promise<ActionResult> {
  const { error } = await db.from("data_room_members").update({ revoked_at: new Date().toISOString() }).eq("id", memberId);
  return error ? fail(error) : ok(undefined);
}

export async function addRoomDocument(db: Db, roomId: string, documentId: string): Promise<ActionResult> {
  const { data: last } = await db.from("data_room_documents").select("position").eq("room_id", roomId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await db.from("data_room_documents").insert({ room_id: roomId, document_id: documentId, position: (last?.position ?? 0) + 1 });
  if (error?.code === "23505") return fail("That document is already in the room.");
  if (error?.code === "22023") return fail(error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".");
  return error ? fail(error) : ok(undefined);
}

export async function removeRoomDocument(db: Db, roomId: string, documentId: string): Promise<ActionResult> {
  const { error } = await db.from("data_room_documents").delete().eq("room_id", roomId).eq("document_id", documentId);
  return error ? fail(error) : ok(undefined);
}

/** Vault documents that can go in a room: current version is PDF, PNG or JPEG. */
export async function roomDocumentOptions(db: Db) {
  const { data } = await db
    .from("documents")
    .select("id, title, confidentiality, version:document_versions!documents_current_version_fk(mime_type)")
    .is("deleted_at", null)
    .order("title")
    .limit(500)
    .returns<{ id: string; title: string; confidentiality: string; version: { mime_type: string } | null }[]>();
  return (data ?? [])
    .filter((d) => d.version && ["application/pdf", "image/png", "image/jpeg"].includes(d.version.mime_type))
    .map((d) => ({ value: d.id, label: `${d.title}${d.confidentiality === "restricted" ? " (restricted)" : ""}` }));
}

// ---------------------------------------------------------------- invites

export async function listInvites(db: Db) {
  const { data } = await db
    .from("user_invites")
    .select("id, email, role, full_name, note, created_at, expires_at, accepted_at, revoked_at, by:profiles!user_invites_invited_by_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<
      { id: string; email: string; role: string; full_name: string | null; note: string | null; created_at: string; expires_at: string; accepted_at: string | null; revoked_at: string | null; by: { full_name: string } | null }[]
    >();
  return data ?? [];
}

export async function createInvite(db: Db, input: { email?: unknown; role?: unknown; full_name?: unknown; title?: unknown }): Promise<ActionResult> {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const role = typeof input.role === "string" && ["principal", "manager", "staff", "external"].includes(input.role) ? (input.role as "principal" | "manager" | "staff" | "external") : null;
  const errors: Record<string, string> = {};
  if (!EMAIL.test(email)) errors.email = "Enter a valid email";
  if (!role) errors.role = "Choose a role";
  if (Object.keys(errors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors: errors };
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
  const { error } = await db.from("user_invites").insert({ email, role: role!, full_name: str(input.full_name), title: str(input.title) });
  if (error?.code === "23505")
    return { ok: false, error: /account/.test(error.message) ? "That address already has an account." : "There's already an open invite for that address.", fieldErrors: { email: "Already invited or signed up" } };
  if (error?.code === "42501") return fail(role === "external" ? "Only managers and principals can invite guests." : "Only a principal (with two-step sign-in) can invite colleagues.");
  return error ? fail(error) : ok(undefined);
}

export async function revokeInvite(db: Db, id: string): Promise<ActionResult> {
  const { data, error } = await db.from("user_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("accepted_at", null).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Only an open invite you're allowed to manage can be revoked.");
}
