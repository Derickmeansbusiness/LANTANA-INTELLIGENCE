"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as contracts from "@/server/contracts";

function refresh(id?: string) {
  revalidatePath("/contracts");
  if (id) revalidatePath(`/contracts/${id}`);
  revalidatePath("/tasks", "layout");
  revalidatePath("/");
}

export async function createContractAction(input: unknown) {
  const r = await contracts.createContract(await createClient(), input);
  if (r.ok) refresh();
  return r;
}
export async function updateContractAction(id: string, input: unknown) {
  const r = await contracts.updateContract(await createClient(), id, input);
  if (r.ok) refresh(id);
  return r;
}
export async function setContractArchivedAction(id: string, archived: boolean) {
  const r = await contracts.setContractArchived(await createClient(), id, archived);
  if (r.ok) refresh(id);
  return r;
}
export async function addSurvivalAction(input: { contract_id: string; clause: string; survival_months: string | number }) {
  const r = await contracts.addSurvival(await createClient(), input);
  if (r.ok) refresh(input.contract_id);
  return r;
}
export async function removeSurvivalAction(contractId: string, id: string) {
  const r = await contracts.removeSurvival(await createClient(), id);
  if (r.ok) refresh(contractId);
  return r;
}
export async function addObligationAction(input: { contract_id: string; description: string; due_date: string; owner_id: string }) {
  const r = await contracts.addObligation(await createClient(), input);
  if (r.ok) refresh(input.contract_id);
  return r;
}
export async function setObligationStatusAction(contractId: string, id: string, status: "open" | "done" | "waived") {
  const r = await contracts.setObligationStatus(await createClient(), id, status);
  if (r.ok) refresh(contractId);
  return r;
}
export async function runAlertsNowAction() {
  const r = await contracts.runAlertsNow(await createClient());
  if (r.ok) revalidatePath("/", "layout");
  return r;
}
