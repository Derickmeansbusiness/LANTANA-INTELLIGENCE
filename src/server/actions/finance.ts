"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ColumnMap } from "@/lib/finance";
import * as finance from "@/server/finance";

function refresh() {
  revalidatePath("/finance", "layout");
  revalidatePath("/");
}

const run =
  <A extends unknown[], R extends { ok: boolean }>(fn: (db: Awaited<ReturnType<typeof createClient>>, ...a: A) => Promise<R>) =>
  async (...a: A) => {
    const r = await fn(await createClient(), ...a);
    if (r.ok) refresh();
    return r;
  };

export async function createTransactionAction(input: unknown) {
  return run(finance.createTransaction)(input);
}
export async function updateTransactionAction(id: string, input: unknown) {
  return run(finance.updateTransaction)(id, input);
}
export async function archiveTransactionAction(id: string) {
  return run(finance.archiveTransaction)(id);
}
export async function previewImportAction(input: { csv: string; bank_account_id: string | null; currency: string; map?: ColumnMap | null }) {
  return finance.previewImport(await createClient(), input);
}
export async function commitImportAction(input: unknown) {
  return run(finance.commitImport)(input);
}
export async function addRuleAction(input: unknown) {
  return run(finance.addRule)(input);
}
export async function archiveRuleAction(id: string) {
  return run(finance.archiveRule)(id);
}
export async function categoriseUncategorisedAction() {
  return run(finance.categoriseUncategorised)();
}
export async function createAccountAction(input: unknown) {
  return run(finance.createAccount)(input);
}
export async function createInvoiceAction(input: unknown) {
  return run(finance.createInvoice)(input);
}
export async function updateInvoiceAction(id: string, input: unknown) {
  return run(finance.updateInvoice)(id, input);
}
export async function addInvoiceItemAction(invoiceId: string, input: unknown) {
  return run(finance.addInvoiceItem)(invoiceId, input);
}
export async function removeInvoiceItemAction(itemId: string) {
  return run(finance.removeInvoiceItem)(itemId);
}
export async function issueInvoiceAction(id: string) {
  return run(finance.issueInvoice)(id);
}
export async function voidInvoiceAction(id: string) {
  return run(finance.voidInvoice)(id);
}
export async function recordInvoicePaymentAction(id: string, input: unknown) {
  return run(finance.recordInvoicePayment)(id, input);
}
export async function createBillAction(input: unknown) {
  return run(finance.createBill)(input);
}
export async function payBillAction(id: string, input: { paid_on: string; bank_account_id?: string | null }) {
  return run(finance.payBill)(id, input);
}
export async function voidBillAction(id: string) {
  return run(finance.voidBill)(id);
}
export async function setBudgetAction(input: unknown) {
  return run(finance.setBudget)(input);
}
export async function rollBudgetForwardAction(month: string) {
  return run(finance.rollBudgetForward)(month);
}
export async function addFxRateAction(input: unknown) {
  return run(finance.addFxRate)(input);
}
