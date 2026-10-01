"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient, createTokenClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { ingestVersion } from "@/server/documents";
import { confirmProposal, rejectProposal } from "@/server/agent/proposals";
import { getThreadView, listThreads, updateThread } from "@/server/agent/threads";
import { generateBriefing } from "@/server/agent/briefing";

export async function listThreadsAction() {
  return listThreads(await createClient());
}

export async function getThreadAction(id: string) {
  return getThreadView(await createClient(), id);
}

export async function updateThreadAction(id: string, patch: { title?: string; pinned?: boolean; archived?: boolean }) {
  const r = await updateThread(await createClient(), id, patch);
  if (r.ok) revalidatePath("/agent");
  return r;
}

/** Confirm a proposal: executes it now, under the confirming user's permissions. */
export async function confirmAgentAction(id: string) {
  const db = await createClient();
  const r = await confirmProposal(db, await getSession(), id);
  if (r.ok) {
    // A generated document gets indexed after the response, like any upload.
    if (r.data.versionId) {
      const { data } = await db.auth.getSession();
      const token = data.session?.access_token;
      const versionId = r.data.versionId;
      if (token) after(() => ingestVersion(createTokenClient(token), versionId, token).then(() => undefined, (e) => console.error("ingest failed", e)));
    }
    revalidatePath("/", "layout");
  }
  return r;
}

export async function rejectAgentAction(id: string) {
  return rejectProposal(await createClient(), await getSession(), id);
}

export async function generateBriefingAction(force = false) {
  return generateBriefing(await createClient(), await getSession(), force);
}
