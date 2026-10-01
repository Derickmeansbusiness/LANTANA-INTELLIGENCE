import "server-only";
import { createHash } from "node:crypto";
import type { Db } from "@/lib/supabase/server";
import { fail, fieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { toMajor, toMinor } from "@/lib/money";
import { shiftDate, todayDubai } from "@/lib/dates";
import { addMonths } from "@/lib/contract-dates";
import { agingBucket, buildPnl, guessColumns, importKeys, monthsBetween, parseCsv, readStatement, runwayMonths, type ColumnMap, type MonthlyRow, type StatementProblem } from "@/lib/finance";
import {
  accountSchema,
  billSchema,
  budgetSchema,
  fxRateSchema,
  importSchema,
  invoiceItemSchema,
  invoiceSchema,
  paymentSchema,
  ruleSchema,
  transactionPatchSchema,
  transactionSchema,
} from "@/lib/schemas/finance";

/**
 * Finance. Ledger, invoices, bills, budgets and rules are manager+ (RLS).
 * Bank accounts, cash and payroll lines are principal-only: RLS hides them
 * from managers, so every function here simply returns less for them.
 */

// ---------------------------------------------------------------- FX

/** Latest rate to AED per currency (AED itself is 1). Missing currencies are absent. */
export async function aedRates(db: Db, onOrBefore = todayDubai()): Promise<Record<string, number>> {
  const { data } = await db.from("fx_rates").select("base, rate, rate_date").eq("quote", "AED").lte("rate_date", onOrBefore).order("rate_date", { ascending: false });
  const out: Record<string, number> = { AED: 1 };
  for (const r of data ?? []) out[r.base] ??= Number(r.rate);
  return out;
}

export function toAed(amountMinor: number, currency: string, rates: Record<string, number>): number | null {
  const r = rates[currency];
  return r == null ? null : toMajor(amountMinor, currency) * r;
}

export async function listFxRates(db: Db) {
  const { data } = await db.from("fx_rates").select("id, rate_date, base, quote, rate, source, is_demo").eq("quote", "AED").order("rate_date", { ascending: false }).limit(200);
  return data ?? [];
}

export async function addFxRate(db: Db, input: unknown): Promise<ActionResult> {
  const p = fxRateSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { error } = await db.from("fx_rates").upsert({ ...p.data, quote: "AED", source: "manual" }, { onConflict: "rate_date,base,quote" });
  return error ? fail(error) : ok(undefined);
}

// ---------------------------------------------------------------- accounts & lookups

export type AccountOpt = { value: string; label: string; type: string; code: string };

export async function listAccounts(db: Db): Promise<AccountOpt[]> {
  const { data } = await db.from("accounts").select("id, code, name, type").is("deleted_at", null).order("code");
  return (data ?? []).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}`, type: a.type, code: a.code }));
}

export async function createAccount(db: Db, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = accountSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data, error } = await db.from("accounts").insert(p.data).select("id").single();
  if (error?.code === "23505") return { ok: false, error: "That code is taken.", fieldErrors: { code: "Already used" } };
  return error ? fail(error) : ok({ id: data.id });
}

/** Bank accounts: principals only (RLS returns none to anyone else). */
export async function bankAccountOptions(db: Db) {
  const { data } = await db.from("bank_accounts").select("id, name, currency, iban_last4").is("deleted_at", null).order("name");
  return (data ?? []).map((b) => ({ value: b.id, label: `${b.name}${b.iban_last4 ? ` ··${b.iban_last4}` : ""}`, currency: b.currency }));
}

// ---------------------------------------------------------------- overview

export type FinanceOverview = Awaited<ReturnType<typeof financeOverview>>;

export async function financeOverview(db: Db, opts: { months?: number; principal: boolean }) {
  const today = todayDubai();
  const to = today;
  const months = monthsBetween(addMonths(`${today.slice(0, 7)}-01`, -((opts.months ?? 6) - 1)), today);
  const from = months[0];
  const [monthly, rates, invoices, bills, cash] = await Promise.all([
    db.rpc("finance_monthly", { p_from: from, p_to: to }),
    aedRates(db),
    db.from("invoices").select("id, invoice_no, due_date, total_minor, currency, status, org:organizations(name)").is("deleted_at", null).eq("status", "sent"),
    db.from("bills").select("id, description, supplier_name, due_date, total_minor, currency, org:organizations(name)").is("deleted_at", null).eq("status", "open"),
    opts.principal ? db.rpc("finance_cash_monthly", { p_from: from, p_to: to }) : Promise.resolve({ data: null, error: null }),
  ]);
  const pnl = buildPnl((monthly.data ?? []) as MonthlyRow[], months);

  const open = (rows: { due_date: string; total_minor: number; currency: string }[]) => {
    const buckets = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    let total = 0;
    let missing = 0;
    for (const r of rows) {
      const v = toAed(r.total_minor, r.currency, rates);
      if (v == null) {
        missing++;
        continue;
      }
      buckets[agingBucket(r.due_date, today)] += v;
      total += v;
    }
    return { buckets, total, count: rows.length, missing };
  };

  const cashRows = (cash.data ?? []) as { month: string; inflow_aed: number; outflow_aed: number; closing_aed: number | null }[];
  const cashSeries = cashRows.map((c) => ({ month: c.month.slice(0, 10), inflow: Number(c.inflow_aed), outflow: Number(c.outflow_aed), closing: c.closing_aed == null ? null : Number(c.closing_aed) }));
  const cashNow = cashSeries.at(-1)?.closing ?? null;
  // Runway from the last three complete months of actual cash movement.
  const complete = cashSeries.slice(0, -1).slice(-3);
  const runway = opts.principal ? runwayMonths(cashNow, complete.map((c) => c.inflow - c.outflow)) : null;

  return {
    today,
    months,
    pnl,
    receivables: open((invoices.data ?? []) as never),
    payables: open((bills.data ?? []) as never),
    cash: opts.principal ? { series: cashSeries, now: cashNow, runway, basis: complete.length } : null,
    error: monthly.error ? "Couldn't load the P&L." : null,
  };
}

// ---------------------------------------------------------------- transactions

export type TxnRow = {
  id: string;
  txn_date: string;
  description: string;
  amount_minor: number;
  currency: string;
  account_id: string | null;
  account: string | null;
  account_type: string | null;
  bank: string | null;
  counterparty: string | null;
  deal: string | null;
  reference: string | null;
  category_source: string;
  is_transfer: boolean;
  is_payroll: boolean;
  is_demo: boolean;
  linked: string | null;
};

export async function listTransactions(db: Db, opts: { since?: string } = {}): Promise<TxnRow[]> {
  const since = opts.since ?? shiftDate(todayDubai(), -400);
  const { data } = await db
    .from("transactions")
    .select(
      "id, txn_date, description, amount_minor, currency, account_id, reference, category_source, is_transfer, is_payroll, is_demo, invoice_id, bill_id, " +
        "account:accounts(code, name, type), bank:bank_accounts(name), org:organizations(name), deal:deals(name), invoice:invoices(invoice_no)",
    )
    .is("deleted_at", null)
    .gte("txn_date", since)
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000)
    .returns<
      {
        id: string;
        txn_date: string;
        description: string;
        amount_minor: number;
        currency: string;
        account_id: string | null;
        reference: string | null;
        category_source: string;
        is_transfer: boolean;
        is_payroll: boolean;
        is_demo: boolean;
        invoice_id: string | null;
        bill_id: string | null;
        account: { code: string; name: string; type: string } | null;
        bank: { name: string } | null;
        org: { name: string } | null;
        deal: { name: string } | null;
        invoice: { invoice_no: string } | null;
      }[]
    >();
  return (data ?? []).map((t) => ({
    id: t.id,
    txn_date: t.txn_date,
    description: t.description,
    amount_minor: t.amount_minor,
    currency: t.currency,
    account_id: t.account_id,
    account: t.account ? `${t.account.code} · ${t.account.name}` : null,
    account_type: t.account?.type ?? null,
    bank: t.bank?.name ?? null,
    counterparty: t.org?.name ?? null,
    deal: t.deal?.name ?? null,
    reference: t.reference,
    category_source: t.category_source,
    is_transfer: t.is_transfer,
    is_payroll: t.is_payroll,
    is_demo: t.is_demo,
    linked: t.invoice ? `Invoice ${t.invoice.invoice_no}` : t.bill_id ? "Bill" : null,
  }));
}

export async function createTransaction(db: Db, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = transactionSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { amount, direction, ...rest } = p.data;
  const minor = toMinor(Math.abs(amount), rest.currency) * (direction === "out" ? -1 : 1);
  const { data, error } = await db
    .from("transactions")
    .insert({ ...rest, amount_minor: minor, category_source: "manual" })
    .select("id")
    .single();
  return error ? fail(error) : ok({ id: data.id });
}

export async function updateTransaction(db: Db, id: string, input: unknown): Promise<ActionResult> {
  const p = transactionPatchSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const patch = { ...p.data, ...("account_id" in p.data ? { category_source: "manual" } : {}) };
  const { data, error } = await db.from("transactions").update(patch).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : { ok: false, error: "Transaction not found." };
}

export async function archiveTransaction(db: Db, id: string): Promise<ActionResult> {
  const { data: t } = await db.from("transactions").select("invoice_id, bill_id, is_payroll").eq("id", id).maybeSingle();
  if (!t) return { ok: false, error: "Transaction not found." };
  if (t.invoice_id || t.bill_id || t.is_payroll) return { ok: false, error: "This line records a payment. Change the invoice, bill or payroll run instead." };
  const { error } = await db.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}

// ---------------------------------------------------------------- statement import

export type ImportPreviewLine = {
  row: number;
  date: string;
  description: string;
  amount: number;
  reference: string | null;
  key: string;
  duplicate: boolean;
  account_id: string | null;
  source: "rule" | "history" | "agent" | "manual";
  reason: string | null;
};

export type ImportPreview = { header: string[]; map: ColumnMap; lines: ImportPreviewLine[]; problems: StatementProblem[] };

const hashKey = (k: string) => createHash("sha256").update(k).digest("hex");

/** Parse a statement and suggest a category per line. Nothing is written. */
export async function previewImport(
  db: Db,
  input: { csv: string; bank_account_id: string | null; currency: string; map?: ColumnMap | null },
): Promise<ActionResult<ImportPreview>> {
  if (input.csv.length > 2_000_000) return { ok: false, error: "That file is too large. Split it into smaller statements." };
  const rows = parseCsv(input.csv);
  if (rows.length < 2) return { ok: false, error: "The file has no data rows." };
  const header = rows[0];
  const map = input.map ?? guessColumns(header);
  if (!map) return { ok: false, error: "Couldn't find date, description and amount columns. Pick them below." , fieldErrors: { map: "needed" } };
  const { lines, problems } = readStatement(rows.slice(1), map);
  if (lines.length > 2000) return { ok: false, error: "Import at most 2,000 lines at a time." };
  const keys = importKeys(input.bank_account_id, input.currency, lines);
  const hashes = keys.map(hashKey);

  const existing = new Set<string>();
  for (let i = 0; i < hashes.length; i += 200) {
    const { data } = await db.from("transactions").select("import_hash").in("import_hash", hashes.slice(i, i + 200)).is("deleted_at", null);
    for (const r of data ?? []) if (r.import_hash) existing.add(r.import_hash);
  }

  const { data: sugg } = await db.rpc("suggest_transaction_categories", { p_descriptions: lines.map((l) => l.description) });
  const byOrd = new Map((sugg ?? []).map((s: { ord: number; account_id: string | null; source: string | null; reason: string | null }) => [s.ord, s]));

  return ok({
    header,
    map,
    problems,
    lines: lines.map((l, i) => {
      const s = byOrd.get(i + 1);
      return {
        ...l,
        key: keys[i],
        duplicate: existing.has(hashes[i]),
        account_id: s?.account_id ?? null,
        source: (s?.source as "rule" | "history" | null) ?? "manual",
        reason: s?.reason ?? null,
      };
    }),
  });
}

export async function commitImport(db: Db, input: unknown): Promise<ActionResult<{ imported: number; skipped: number; importId: string }>> {
  const p = importSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Nothing to import." };
  const { file_name, bank_account_id, currency, lines } = p.data;
  const { data: imp, error: impErr } = await db
    .from("transaction_imports")
    .insert({ file_name, bank_account_id: bank_account_id ?? null, row_count: lines.length })
    .select("id")
    .single();
  if (impErr) return fail(impErr);

  const rows = lines.map((l) => ({
    txn_date: l.date,
    description: l.description,
    amount_minor: toMinor(l.amount, currency),
    currency,
    bank_account_id: bank_account_id ?? null,
    account_id: l.account_id,
    category_source: l.account_id ? l.source : "manual",
    reference: l.reference,
    import_id: imp.id,
    import_hash: hashKey(l.key),
  }));

  let imported = 0;
  let skipped = 0;
  const bulk = await db.from("transactions").insert(rows).select("id");
  if (!bulk.error) imported = bulk.data.length;
  else if (bulk.error.code === "23505") {
    // Some lines already exist: insert one by one and count the duplicates.
    for (const r of rows) {
      const one = await db.from("transactions").insert(r);
      if (!one.error) imported++;
      else if (one.error.code === "23505") skipped++;
      else return fail(one.error);
    }
  } else return fail(bulk.error);

  await db.from("transaction_imports").update({ imported_count: imported, skipped_count: skipped }).eq("id", imp.id);
  return ok({ imported, skipped, importId: imp.id });
}

// ---------------------------------------------------------------- rules

export async function listRules(db: Db) {
  const { data } = await db
    .from("category_rules")
    .select("id, pattern, account_id, is_demo, account:accounts(code, name)")
    .is("deleted_at", null)
    .order("pattern")
    .returns<{ id: string; pattern: string; account_id: string; is_demo: boolean; account: { code: string; name: string } | null }[]>();
  return data ?? [];
}

export async function addRule(db: Db, input: unknown): Promise<ActionResult> {
  const p = ruleSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { error } = await db.from("category_rules").insert({ pattern: p.data.pattern.toLowerCase(), account_id: p.data.account_id });
  return error ? fail(error) : ok(undefined);
}

export async function archiveRule(db: Db, id: string): Promise<ActionResult> {
  const { error } = await db.from("category_rules").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}

/** Apply rules and history to uncategorised lines; returns how many got a category. */
export async function categoriseUncategorised(db: Db): Promise<ActionResult<{ updated: number }>> {
  const { data: rows } = await db.from("transactions").select("id, description").is("deleted_at", null).is("account_id", null).limit(500);
  if (!rows?.length) return ok({ updated: 0 });
  const { data: sugg, error } = await db.rpc("suggest_transaction_categories", { p_descriptions: rows.map((r) => r.description) });
  if (error) return fail(error);
  let updated = 0;
  for (const s of sugg ?? []) {
    if (!s.account_id) continue;
    const r = rows[s.ord - 1];
    const u = await db.from("transactions").update({ account_id: s.account_id, category_source: s.source }).eq("id", r.id).is("account_id", null);
    if (!u.error) updated++;
  }
  return ok({ updated });
}

// ---------------------------------------------------------------- invoices

export type InvoiceRow = {
  id: string;
  invoice_no: string;
  client: string | null;
  deal: string | null;
  kind: string;
  issue_date: string;
  due_date: string;
  currency: string;
  total_minor: number;
  status: string;
  paid_at: string | null;
  aging: string | null;
  is_demo: boolean;
};

export async function listInvoices(db: Db): Promise<InvoiceRow[]> {
  const today = todayDubai();
  const { data } = await db
    .from("invoices")
    .select("id, invoice_no, kind, issue_date, due_date, currency, total_minor, status, paid_at, is_demo, org:organizations(name), deal:deals(name)")
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .returns<(Omit<InvoiceRow, "client" | "deal" | "aging"> & { org: { name: string } | null; deal: { name: string } | null })[]>();
  return (data ?? []).map((i) => ({
    ...i,
    client: i.org?.name ?? null,
    deal: i.deal?.name ?? null,
    aging: i.status === "sent" ? agingBucket(i.due_date, today) : null,
  }));
}

export async function getInvoice(db: Db, id: string) {
  const { data } = await db
    .from("invoices")
    .select(
      "id, invoice_no, kind, issue_date, due_date, currency, subtotal_minor, vat_rate, vat_minor, total_minor, status, paid_at, reference, notes, is_demo, organization_id, deal_id, " +
        "org:organizations(id, name), deal:deals(id, name), items:invoice_items(id, position, description, quantity, unit_price_minor, amount_minor), " +
        "payments:transactions(id, txn_date, amount_minor, currency, deleted_at)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
    .returns<{
      id: string;
      invoice_no: string;
      kind: string;
      issue_date: string;
      due_date: string;
      currency: string;
      subtotal_minor: number | null;
      vat_rate: number;
      vat_minor: number;
      total_minor: number;
      status: string;
      paid_at: string | null;
      reference: string | null;
      notes: string | null;
      is_demo: boolean;
      organization_id: string | null;
      deal_id: string | null;
      org: { id: string; name: string } | null;
      deal: { id: string; name: string } | null;
      items: { id: string; position: number; description: string; quantity: number; unit_price_minor: number; amount_minor: number }[];
      payments: { id: string; txn_date: string; amount_minor: number; currency: string; deleted_at: string | null }[];
    }>();
  if (!data) return null;
  return {
    ...data,
    items: [...data.items].sort((a, b) => a.position - b.position),
    payments: data.payments.filter((p) => !p.deleted_at),
  };
}

async function nextInvoiceNo(db: Db, issueDate: string) {
  const year = issueDate.slice(0, 4);
  const { data } = await db.from("invoices").select("invoice_no").like("invoice_no", `LV-${year}-%`);
  const max = Math.max(0, ...(data ?? []).map((r) => Number(r.invoice_no.split("-")[2]) || 0));
  return `LV-${year}-${String(max + 1).padStart(3, "0")}`;
}

export async function createInvoice(db: Db, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = invoiceSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  for (let attempt = 0; attempt < 3; attempt++) {
    const invoice_no = await nextInvoiceNo(db, p.data.issue_date);
    const { data, error } = await db
      .from("invoices")
      .insert({ ...p.data, invoice_no, status: "draft", total_minor: 0, subtotal_minor: 0 })
      .select("id")
      .single();
    if (!error) return ok({ id: data.id });
    if (error.code !== "23505") return fail(error);
  }
  return { ok: false, error: "Couldn't assign an invoice number. Try again." };
}

export async function updateInvoice(db: Db, id: string, input: unknown): Promise<ActionResult> {
  const p = invoiceSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data, error } = await db.from("invoices").update(p.data).eq("id", id).eq("status", "draft").select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : { ok: false, error: "Only a draft invoice can be edited." };
}

export async function addInvoiceItem(db: Db, invoiceId: string, input: unknown): Promise<ActionResult> {
  const p = invoiceItemSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the line.", fieldErrors: fieldErrors(p.error.issues) };
  const { data: inv } = await db.from("invoices").select("currency, items:invoice_items(position)").eq("id", invoiceId).maybeSingle()
    .returns<{ currency: string; items: { position: number }[] }>();
  if (!inv) return { ok: false, error: "Invoice not found." };
  const position = Math.max(0, ...inv.items.map((i) => i.position)) + 1;
  const { error } = await db.from("invoice_items").insert({
    invoice_id: invoiceId,
    position,
    description: p.data.description,
    quantity: p.data.quantity,
    unit_price_minor: toMinor(p.data.unit_price, inv.currency),
  });
  return error ? fail(error) : ok(undefined);
}

export async function removeInvoiceItem(db: Db, itemId: string): Promise<ActionResult> {
  const { data, error } = await db.from("invoice_items").delete().eq("id", itemId).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : { ok: false, error: "Line not found." };
}

export async function issueInvoice(db: Db, id: string): Promise<ActionResult> {
  const { data: inv } = await db.from("invoices").select("status, total_minor, organization_id").eq("id", id).maybeSingle();
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status !== "draft") return { ok: false, error: "Already issued." };
  if (!inv.total_minor || inv.total_minor <= 0) return { ok: false, error: "Add at least one line before issuing." };
  if (!inv.organization_id) return { ok: false, error: "Choose who you're billing first." };
  const { error } = await db.from("invoices").update({ status: "sent" }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}

export async function voidInvoice(db: Db, id: string): Promise<ActionResult> {
  const { data: inv } = await db.from("invoices").select("status").eq("id", id).maybeSingle();
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status === "paid") return { ok: false, error: "A paid invoice can't be voided. Record a credit note as a new transaction instead." };
  const { error } = await db.from("invoices").update({ status: "void" }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}

/** Mark an invoice paid and record the receipt in the ledger. */
export async function recordInvoicePayment(db: Db, id: string, input: unknown): Promise<ActionResult> {
  const p = paymentSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data: inv } = await db.from("invoices").select("invoice_no, status, total_minor, currency, organization_id, deal_id").eq("id", id).maybeSingle();
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status !== "sent") return { ok: false, error: inv.status === "paid" ? "Already paid." : "Issue the invoice first." };
  const t = await db.from("transactions").insert({
    txn_date: p.data.paid_on,
    description: `Payment received: invoice ${inv.invoice_no}`,
    amount_minor: inv.total_minor,
    currency: inv.currency,
    account_id: p.data.account_id,
    bank_account_id: p.data.bank_account_id ?? null,
    counterparty_org_id: inv.organization_id,
    deal_id: inv.deal_id,
    invoice_id: id,
    reference: inv.invoice_no,
  });
  if (t.error) return fail(t.error);
  const { error } = await db.from("invoices").update({ status: "paid", paid_at: p.data.paid_on }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}

// ---------------------------------------------------------------- bills

export type BillRow = {
  id: string;
  supplier: string;
  reference: string | null;
  description: string;
  account: string | null;
  issue_date: string;
  due_date: string;
  currency: string;
  total_minor: number;
  status: string;
  paid_at: string | null;
  aging: string | null;
  is_demo: boolean;
};

export async function listBills(db: Db): Promise<BillRow[]> {
  const today = todayDubai();
  const { data } = await db
    .from("bills")
    .select("id, supplier_name, reference, description, issue_date, due_date, currency, total_minor, status, paid_at, is_demo, org:organizations(name), account:accounts(code, name)")
    .is("deleted_at", null)
    .order("due_date", { ascending: false })
    .returns<
      {
        id: string;
        supplier_name: string | null;
        reference: string | null;
        description: string;
        issue_date: string;
        due_date: string;
        currency: string;
        total_minor: number;
        status: string;
        paid_at: string | null;
        is_demo: boolean;
        org: { name: string } | null;
        account: { code: string; name: string } | null;
      }[]
    >();
  return (data ?? []).map((b) => ({
    id: b.id,
    supplier: b.org?.name ?? b.supplier_name ?? "—",
    reference: b.reference,
    description: b.description,
    account: b.account ? `${b.account.code} · ${b.account.name}` : null,
    issue_date: b.issue_date,
    due_date: b.due_date,
    currency: b.currency,
    total_minor: b.total_minor,
    status: b.status,
    paid_at: b.paid_at,
    aging: b.status === "open" ? agingBucket(b.due_date, today) : null,
    is_demo: b.is_demo,
  }));
}

export async function createBill(db: Db, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = billSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { total, ...rest } = p.data;
  const { data, error } = await db.from("bills").insert({ ...rest, total_minor: toMinor(total, rest.currency) }).select("id").single();
  return error ? fail(error) : ok({ id: data.id });
}

/** Mark a bill paid and record the payment in the ledger (under the bill's expense account). */
export async function payBill(db: Db, id: string, input: { paid_on: string; bank_account_id?: string | null }): Promise<ActionResult> {
  const p = paymentSchema.omit({ account_id: true }).safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data: b } = await db.from("bills").select("description, reference, status, total_minor, currency, account_id, supplier_org_id").eq("id", id).maybeSingle();
  if (!b) return { ok: false, error: "Bill not found." };
  if (b.status !== "open") return { ok: false, error: b.status === "paid" ? "Already paid." : "This bill was voided." };
  const t = await db.from("transactions").insert({
    txn_date: p.data.paid_on,
    description: `Bill paid: ${b.description}`,
    amount_minor: -b.total_minor,
    currency: b.currency,
    account_id: b.account_id,
    bank_account_id: p.data.bank_account_id ?? null,
    counterparty_org_id: b.supplier_org_id,
    bill_id: id,
    reference: b.reference,
  });
  if (t.error) return fail(t.error);
  const { error } = await db.from("bills").update({ status: "paid", paid_at: p.data.paid_on }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}

export async function voidBill(db: Db, id: string): Promise<ActionResult> {
  const { data, error } = await db.from("bills").update({ status: "void" }).eq("id", id).eq("status", "open").select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : { ok: false, error: "Only an open bill can be voided." };
}

// ---------------------------------------------------------------- budgets

export type BudgetLine = { account_id: string; code: string; name: string; type: string; budget: number | null; actual: number; variance: number | null };

/** Budget vs actual for one month, in AED. Actuals include payroll in aggregate. */
export async function budgetVsActual(db: Db, month: string): Promise<{ lines: BudgetLine[]; missingFx: number }> {
  const end = shiftDate(monthsBetween(month, shiftDate(month, 32))[1] ?? month, -1);
  const [accounts, budgets, monthly] = await Promise.all([
    db.from("accounts").select("id, code, name, type").is("deleted_at", null).in("type", ["income", "expense"]).order("code"),
    db.from("budgets").select("account_id, amount_minor, currency").eq("month", month).is("deleted_at", null),
    db.rpc("finance_monthly", { p_from: month, p_to: end }),
  ]);
  const rates = await aedRates(db, end);
  const budgetBy = new Map((budgets.data ?? []).map((b) => [b.account_id, toAed(b.amount_minor, b.currency, rates)]));
  const actualBy = new Map<string, number>();
  let missingFx = 0;
  for (const r of (monthly.data ?? []) as MonthlyRow[]) {
    missingFx += r.missing_fx;
    if (r.account_id) actualBy.set(r.account_id, (actualBy.get(r.account_id) ?? 0) + Number(r.amount_aed));
  }
  const lines = (accounts.data ?? []).map((a) => {
    const raw = actualBy.get(a.id) ?? 0;
    const actual = a.type === "income" ? raw : -raw;
    const budget = budgetBy.get(a.id) ?? null;
    // Positive variance is good: income above budget, spending below it.
    const variance = budget == null ? null : a.type === "income" ? actual - budget : budget - actual;
    return { account_id: a.id, code: a.code, name: a.name, type: a.type, budget, actual, variance };
  });
  return { lines, missingFx };
}

export async function setBudget(db: Db, input: unknown): Promise<ActionResult> {
  const p = budgetSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the amount." };
  const amount_minor = toMinor(p.data.amount, "AED");
  const { data: existing } = await db.from("budgets").select("id").eq("account_id", p.data.account_id).eq("month", p.data.month).is("deleted_at", null).maybeSingle();
  const { error } = existing
    ? await db.from("budgets").update({ amount_minor, currency: "AED" }).eq("id", existing.id)
    : await db.from("budgets").insert({ account_id: p.data.account_id, month: p.data.month, amount_minor, currency: "AED" });
  return error ? fail(error) : ok(undefined);
}

/** Copy one month's budget lines onto the next N months where none exist yet. */
export async function rollBudgetForward(db: Db, month: string, months = 3): Promise<ActionResult<{ created: number }>> {
  const { data: src } = await db.from("budgets").select("account_id, amount_minor, currency").eq("month", month).is("deleted_at", null);
  if (!src?.length) return { ok: false, error: "This month has no budget to copy." };
  const targets = monthsBetween(month, shiftDate(month, 31 * months + 1)).slice(1, months + 1);
  let created = 0;
  for (const m of targets) {
    const { data: have } = await db.from("budgets").select("account_id").eq("month", m).is("deleted_at", null);
    const taken = new Set((have ?? []).map((h) => h.account_id));
    const rows = src.filter((s) => !taken.has(s.account_id)).map((s) => ({ ...s, month: m }));
    if (!rows.length) continue;
    const { error } = await db.from("budgets").insert(rows);
    if (error) return fail(error);
    created += rows.length;
  }
  return ok({ created });
}
