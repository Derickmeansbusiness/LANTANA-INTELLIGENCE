"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import * as deals from "@/server/deals";

function refresh(id?: string) {
  revalidatePath("/deals");
  revalidatePath("/");
  if (id) revalidatePath(`/deals/${id}`);
}

export async function createDealAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await deals.createDeal(await createClient(), input);
  if (r.ok) refresh(r.data.id);
  return r;
}

export async function updateDealAction(id: string, input: unknown): Promise<ActionResult> {
  const r = await deals.updateDeal(await createClient(), id, input);
  if (r.ok) refresh(id);
  return r;
}

export async function moveDealStageAction(input: { dealId: string; stage: string; note?: string | null }): Promise<ActionResult> {
  const r = await deals.moveDealStage(await createClient(), input);
  if (r.ok) refresh(input.dealId);
  return r;
}

export async function setDealArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const r = await deals.setDealArchived(await createClient(), id, archived);
  if (r.ok) refresh(id);
  return r;
}

export async function addDealPartyAction(input: unknown): Promise<ActionResult> {
  const r = await deals.addDealParty(await createClient(), input);
  if (r.ok) refresh((input as { dealId: string }).dealId);
  return r;
}

export async function removeDealPartyAction(dealId: string, partyId: string): Promise<ActionResult> {
  const r = await deals.removeDealParty(await createClient(), partyId);
  if (r.ok) refresh(dealId);
  return r;
}

export async function addDealMemberAction(dealId: string, userId: string): Promise<ActionResult> {
  const r = await deals.addDealMember(await createClient(), dealId, userId);
  if (r.ok) refresh(dealId);
  return r;
}

export async function removeDealMemberAction(dealId: string, userId: string): Promise<ActionResult> {
  const r = await deals.removeDealMember(await createClient(), dealId, userId);
  if (r.ok) refresh(dealId);
  return r;
}

export async function logIntroductionAction(input: unknown): Promise<ActionResult<{ id: string; seq: number }>> {
  const r = await deals.logIntroduction(await createClient(), input);
  if (r.ok) {
    revalidatePath("/deals/ledger");
    const dealId = (input as { deal_id?: string }).deal_id;
    refresh(dealId || undefined);
  }
  return r;
}
