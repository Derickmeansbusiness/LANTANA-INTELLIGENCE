"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as rooms from "@/server/data-rooms";

async function run<R extends { ok: boolean }>(fn: (db: Awaited<ReturnType<typeof createClient>>) => Promise<R>, extra?: string) {
  const r = await fn(await createClient());
  if (r.ok) {
    revalidatePath("/data-rooms", "layout");
    if (extra) revalidatePath(extra);
  }
  return r;
}

export async function saveRoomAction(id: string | null, input: Parameters<typeof rooms.saveRoom>[2]) {
  return run((db) => rooms.saveRoom(db, id, input));
}
export async function archiveRoomAction(id: string) {
  return run((db) => rooms.archiveRoom(db, id));
}
export async function addMemberAction(roomId: string, input: Parameters<typeof rooms.addMember>[2]) {
  return run((db) => rooms.addMember(db, roomId, input), "/settings");
}
export async function revokeMemberAction(memberId: string) {
  return run((db) => rooms.revokeMember(db, memberId));
}
export async function addRoomDocumentAction(roomId: string, documentId: string) {
  return run((db) => rooms.addRoomDocument(db, roomId, documentId));
}
export async function removeRoomDocumentAction(roomId: string, documentId: string) {
  return run((db) => rooms.removeRoomDocument(db, roomId, documentId));
}
export async function createInviteAction(input: Parameters<typeof rooms.createInvite>[1]) {
  return run((db) => rooms.createInvite(db, input), "/settings");
}
export async function revokeInviteAction(id: string) {
  return run((db) => rooms.revokeInvite(db, id), "/settings");
}
