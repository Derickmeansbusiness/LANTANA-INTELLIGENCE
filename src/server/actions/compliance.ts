"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as compliance from "@/server/compliance";

async function run<R extends { ok: boolean }>(fn: (db: Awaited<ReturnType<typeof createClient>>) => Promise<R>) {
  const r = await fn(await createClient());
  if (r.ok) {
    revalidatePath("/compliance", "layout");
    revalidatePath("/");
  }
  return r;
}

export async function saveObligationAction(id: string | null, input: unknown) {
  return run((db) => compliance.saveObligation(db, id, input));
}
export async function setObligationStatusAction(id: string, status: string) {
  return run((db) => compliance.setObligationStatus(db, id, status));
}
export async function archiveObligationAction(id: string) {
  return run((db) => compliance.archiveObligation(db, id));
}
export async function saveRecordAction(id: string | null, input: unknown) {
  return run((db) => compliance.saveRecord(db, id, input));
}
export async function archiveRecordAction(id: string) {
  return run((db) => compliance.archiveRecord(db, id));
}
export async function saveMeetingAction(id: string | null, input: unknown) {
  return run((db) => compliance.saveMeeting(db, id, input));
}
export async function approveMinutesAction(id: string) {
  return run((db) => compliance.approveMinutes(db, id));
}
export async function saveResolutionAction(id: string | null, input: unknown) {
  return run((db) => compliance.saveResolution(db, id, input));
}
