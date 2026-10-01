"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as people from "@/server/people";
import { getSession } from "@/server/session";

function refresh() {
  revalidatePath("/people", "layout");
  revalidatePath("/");
}

async function withDb<R extends { ok: boolean }>(fn: (db: Awaited<ReturnType<typeof createClient>>) => Promise<R>, opts: { refresh?: boolean; finance?: boolean } = {}) {
  const r = await fn(await createClient());
  if (r.ok && opts.refresh !== false) refresh();
  if (r.ok && opts.finance) revalidatePath("/finance", "layout");
  return r;
}

export async function createEmployeeAction(input: unknown) {
  return withDb((db) => people.createEmployee(db, input));
}
export async function updateEmployeeAction(id: string, input: unknown) {
  return withDb((db) => people.updateEmployee(db, id, input));
}
export async function setIdentityAction(employeeId: string, input: unknown) {
  return withDb((db) => people.setIdentity(db, employeeId, input));
}
export async function revealIdentityAction(employeeId: string) {
  return withDb((db) => people.revealIdentity(db, employeeId), { refresh: false });
}
export async function compensationHistoryAction(employeeId: string) {
  return withDb((db) => people.compensationHistory(db, employeeId), { refresh: false });
}
export async function addCompensationAction(employeeId: string, input: unknown) {
  return withDb((db) => people.addCompensation(db, employeeId, input));
}
export async function requestLeaveAction(input: unknown) {
  return withDb((db) => people.requestLeave(db, input));
}
export async function decideLeaveAction(id: string, decision: "approved" | "rejected" | "cancelled", note?: string) {
  return withDb((db) => people.decideLeave(db, id, decision, note));
}
export async function setLeaveBalanceAction(input: unknown) {
  return withDb((db) => people.setLeaveBalance(db, input));
}
export async function startChecklistAction(employeeId: string, kind: "onboarding" | "offboarding") {
  const session = await getSession();
  return withDb((db) => people.startChecklist(db, employeeId, kind, session.userId));
}
export async function toggleChecklistItemAction(itemId: string, done: boolean) {
  return withDb((db) => people.toggleChecklistItem(db, itemId, done));
}
export async function addChecklistItemAction(checklistId: string, title: string, dueDate: string | null, ownerId: string | null) {
  return withDb((db) => people.addChecklistItem(db, checklistId, title, dueDate, ownerId));
}
export async function createPayrollRunAction(period: string) {
  return withDb((db) => people.createPayrollRun(db, period));
}
export async function updatePayrollLineAction(itemId: string, currency: string, input: unknown) {
  return withDb((db) => people.updatePayrollLine(db, itemId, currency, input));
}
export async function setPayrollStatusAction(runId: string, status: "approved" | "draft" | "paid" | "void", pay?: { bank_account_id: string; account_id: string; paid_on: string }) {
  return withDb((db) => people.setPayrollStatus(db, runId, status, pay), { finance: status === "paid" });
}
export async function setPayrollWpsAction(runId: string, status: string, reference?: string, note?: string) {
  return withDb((db) => people.setPayrollWps(db, runId, status, reference, note));
}
export async function setWpsSettingsAction(input: unknown) {
  return withDb((db) => people.setWpsSettings(db, input));
}
