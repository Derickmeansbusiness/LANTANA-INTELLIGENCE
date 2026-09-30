"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import * as rel from "@/server/relationships";

const pathFor = (type: string, id: string) => (type === "deal" ? `/deals/${id}` : type === "organization" ? `/partners/${id}` : `/tasks/projects/${id}`);

export async function addNoteAction(input: { entityType: string; entityId: string; body: string; pinned?: boolean }): Promise<ActionResult> {
  const r = await rel.addNote(await createClient(), input);
  if (r.ok) revalidatePath(pathFor(input.entityType, input.entityId));
  return r;
}

export async function updateNoteAction(id: string, patch: { pinned?: boolean; archived?: boolean }, path: string): Promise<ActionResult> {
  const r = await rel.updateNote(await createClient(), id, patch);
  if (r.ok) revalidatePath(path);
  return r;
}

export async function logInteractionAction(input: Record<string, unknown>): Promise<ActionResult> {
  const r = await rel.logInteraction(await createClient(), input);
  if (r.ok) {
    if (input.organization_id) revalidatePath(`/partners/${input.organization_id}`);
    if (input.deal_id) revalidatePath(`/deals/${input.deal_id}`);
    revalidatePath("/partners");
  }
  return r;
}

export async function createOrganizationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await rel.createOrganization(await createClient(), input);
  if (r.ok) revalidatePath("/partners");
  return r;
}

export async function updateOrganizationAction(id: string, input: unknown): Promise<ActionResult> {
  const r = await rel.updateOrganization(await createClient(), id, input);
  if (r.ok) {
    revalidatePath("/partners");
    revalidatePath(`/partners/${id}`);
  }
  return r;
}

export async function setOrganizationArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const r = await rel.setOrganizationArchived(await createClient(), id, archived);
  if (r.ok) {
    revalidatePath("/partners");
    revalidatePath(`/partners/${id}`);
  }
  return r;
}

export async function createContactAction(input: { organization_id?: string | null } & Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const r = await rel.createContact(await createClient(), input);
  if (r.ok) {
    revalidatePath("/partners");
    if (input.organization_id) revalidatePath(`/partners/${input.organization_id}`);
  }
  return r;
}

export async function updateContactAction(id: string, input: { organization_id?: string | null } & Record<string, unknown>): Promise<ActionResult> {
  const r = await rel.updateContact(await createClient(), id, input);
  if (r.ok) {
    revalidatePath("/partners");
    if (input.organization_id) revalidatePath(`/partners/${input.organization_id}`);
  }
  return r;
}
