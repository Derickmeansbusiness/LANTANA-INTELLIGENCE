import "server-only";
import type { Db } from "@/lib/supabase/server";
import { fail, fieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { toMinor } from "@/lib/money";
import { shiftDate, todayDubai } from "@/lib/dates";
import { CHECKLIST_TEMPLATES, buildSif, workingDays, type WpsRow } from "@/lib/people";
import { compensationSchema, employeeSchema, identitySchema, leaveBalanceSchema, leaveRequestSchema, payrollItemSchema, wpsSettingsSchema } from "@/lib/schemas/people";

/**
 * People & HR. Employee records are manager+ (plus each person's own row);
 * everyone internal sees the directory through people_directory(). Identity,
 * compensation and payroll are principal-only and only ever written or read
 * in clear through SECURITY DEFINER functions, which audit every read.
 */

// ---------------------------------------------------------------- employees

export type EmployeeRow = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  work_email: string | null;
  status: string;
  employment_type: string;
  start_date: string | null;
  manager: string | null;
  login: string | null;
  next_expiry: { what: string; date: string } | null;
  is_demo: boolean;
};

const EXPIRIES = [
  ["visa_expiry", "Residence visa"],
  ["emirates_id_expiry", "Emirates ID"],
  ["labour_card_expiry", "Labour card"],
  ["passport_expiry", "Passport"],
  ["insurance_expiry", "Health insurance"],
] as const;

export function nextExpiry(e: Partial<Record<(typeof EXPIRIES)[number][0], string | null>>) {
  let best: { what: string; date: string } | null = null;
  for (const [k, what] of EXPIRIES) {
    const d = e[k];
    if (d && (!best || d < best.date)) best = { what, date: d };
  }
  return best;
}

export async function listEmployees(db: Db): Promise<EmployeeRow[]> {
  const { data } = await db
    .from("employees")
    .select(
      "id, full_name, job_title, department, work_email, status, employment_type, start_date, is_demo, visa_expiry, emirates_id_expiry, labour_card_expiry, passport_expiry, insurance_expiry, " +
        "manager:manager_id(full_name), profile:profiles!employees_profile_id_fkey(email)",
    )
    .is("deleted_at", null)
    .order("full_name")
    .returns<
      (Omit<EmployeeRow, "manager" | "login" | "next_expiry"> &
        Record<(typeof EXPIRIES)[number][0], string | null> & { manager: { full_name: string } | null; profile: { email: string } | null })[]
    >();
  return (data ?? []).map((e) => ({
    id: e.id,
    full_name: e.full_name,
    job_title: e.job_title,
    department: e.department,
    work_email: e.work_email,
    status: e.status,
    employment_type: e.employment_type,
    start_date: e.start_date,
    manager: e.manager?.full_name ?? null,
    login: e.profile?.email ?? null,
    next_expiry: e.status === "left" ? null : nextExpiry(e),
    is_demo: e.is_demo,
  }));
}

export type DirectoryRow = { id: string; full_name: string; job_title: string | null; department: string | null; work_email: string | null; phone: string | null; manager_name: string | null; status: string; is_self: boolean };

export async function directory(db: Db): Promise<DirectoryRow[]> {
  const { data } = await db.rpc("people_directory");
  return (data ?? []) as DirectoryRow[];
}

export async function myEmployeeId(db: Db, userId: string) {
  const { data } = await db.from("employees").select("id").eq("profile_id", userId).is("deleted_at", null).maybeSingle();
  return data?.id ?? null;
}

export async function getEmployee(db: Db, id: string) {
  const { data: e } = await db
    .from("employees")
    .select("*, manager:manager_id(id, full_name), profile:profiles!employees_profile_id_fkey(id, email, full_name, role)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
    .returns<
      Record<string, unknown> & {
        id: string;
        full_name: string;
        status: string;
        start_date: string | null;
        end_date: string | null;
        manager: { id: string; full_name: string } | null;
        profile: { id: string; email: string; full_name: string; role: string } | null;
      }
    >();
  if (!e) return null;
  const year = Number(todayDubai().slice(0, 4));
  const [balances, leave, checklists, identity, docs] = await Promise.all([
    db.from("v_leave_balances").select("*").eq("employee_id", id).eq("year", year).order("kind"),
    db
      .from("leave_requests")
      .select("id, kind, start_date, end_date, days, reason, status, decided_at, decision_note, decider:profiles!leave_requests_decided_by_fkey(full_name)")
      .eq("employee_id", id)
      .is("deleted_at", null)
      .order("start_date", { ascending: false })
      .limit(50),
    db
      .from("checklists")
      .select("id, kind, title, created_at, items:checklist_items(id, position, title, due_date, done_at, owner_id, owner:profiles!checklist_items_owner_id_fkey(full_name), doner:profiles!checklist_items_done_by_fkey(full_name))")
      .eq("employee_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    // Principal-only RLS: everyone else gets null. Only the masked columns are selected.
    db
      .from("employee_identity")
      .select("nationality, date_of_birth, passport_last4, emirates_id_last4, iban_last4, bank_name, bank_routing_code, has_visa:visa_file_no_enc, has_labour:labour_card_no_enc, has_mohre:mohre_person_code_enc")
      .eq("employee_id", id)
      .maybeSingle(),
    db.from("document_links").select("document:documents(id, title, doc_type, created_at, deleted_at)").eq("entity_type", "employee").eq("entity_id", id),
  ]);
  const ident = identity.data as
    | (Record<string, string | null> & { has_visa: unknown; has_labour: unknown; has_mohre: unknown })
    | null;
  return {
    e,
    balances: balances.data ?? [],
    leave: leave.data ?? [],
    checklists: (checklists.data ?? []).map((c) => ({ ...c, items: [...c.items].sort((a, b) => a.position - b.position) })),
    identity: ident
      ? {
          nationality: ident.nationality,
          date_of_birth: ident.date_of_birth,
          passport_last4: ident.passport_last4,
          emirates_id_last4: ident.emirates_id_last4,
          iban_last4: ident.iban_last4,
          bank_name: ident.bank_name,
          bank_routing_code: ident.bank_routing_code,
          has_visa: Boolean(ident.has_visa),
          has_labour: Boolean(ident.has_labour),
          has_mohre: Boolean(ident.has_mohre),
        }
      : null,
    documents: (docs.data ?? [])
      .map((d) => d.document as unknown as { id: string; title: string; doc_type: string; created_at: string; deleted_at: string | null } | null)
      .filter((d): d is NonNullable<typeof d> => Boolean(d && !d.deleted_at)),
  };
}

export async function createEmployee(db: Db, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = employeeSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data, error } = await db.from("employees").insert(p.data).select("id").single();
  if (error?.code === "23505") return { ok: false, error: "That login is already linked to another employee.", fieldErrors: { profile_id: "Already linked" } };
  return error ? fail(error) : ok({ id: data.id });
}

export async function updateEmployee(db: Db, id: string, input: unknown): Promise<ActionResult> {
  const p = employeeSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  if (p.data.manager_id === id) return { ok: false, error: "Someone can't report to themselves.", fieldErrors: { manager_id: "Choose someone else" } };
  const { data, error } = await db.from("employees").update(p.data).eq("id", id).select("id");
  if (error?.code === "23505") return { ok: false, error: "That login is already linked to another employee.", fieldErrors: { profile_id: "Already linked" } };
  if (error) return fail(error);
  return data?.length ? ok(undefined) : { ok: false, error: "Employee not found." };
}

// ---------------------------------------------------------------- identity & pay (principal)

export async function setIdentity(db: Db, employeeId: string, input: unknown): Promise<ActionResult> {
  const p = identitySchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  // Only send fields the person actually typed in (an empty string clears).
  const values = Object.fromEntries(Object.entries(p.data).filter(([, v]) => v !== undefined));
  const { error } = await db.rpc("set_employee_identity", { p_employee: employeeId, p_values: values });
  return error ? fail(error) : ok(undefined);
}

export async function revealIdentity(db: Db, employeeId: string): Promise<ActionResult<Record<string, string | null>>> {
  const { data, error } = await db.rpc("reveal_employee_identity", { p_employee: employeeId });
  return error ? fail(error) : ok((data ?? {}) as Record<string, string | null>);
}

export type CompRow = { id: string; effective_from: string; currency: string; basic_minor: number; housing_minor: number; transport_minor: number; other_minor: number; total_minor: number; note: string | null };

export async function compensationHistory(db: Db, employeeId: string): Promise<ActionResult<CompRow[]>> {
  const { data, error } = await db.rpc("employee_compensation_history", { p_employee: employeeId });
  return error ? fail(error) : ok((data ?? []) as CompRow[]);
}

export async function addCompensation(db: Db, employeeId: string, input: unknown): Promise<ActionResult> {
  const p = compensationSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const c = p.data.currency;
  const { error } = await db.rpc("add_employee_compensation", {
    p_employee: employeeId,
    p_effective_from: p.data.effective_from,
    p_currency: c,
    p_basic_minor: toMinor(p.data.basic, c),
    p_housing_minor: toMinor(p.data.housing, c),
    p_transport_minor: toMinor(p.data.transport, c),
    p_other_minor: toMinor(p.data.other, c),
    p_note: p.data.note ?? undefined,
  });
  if (error?.code === "23505") return { ok: false, error: "There's already a pay change on that date.", fieldErrors: { effective_from: "Pick another date" } };
  return error ? fail(error) : ok(undefined);
}

// ---------------------------------------------------------------- leave

export type LeaveRow = {
  id: string;
  employee_id: string;
  employee: string;
  kind: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: string;
  decided_by: string | null;
  decision_note: string | null;
  is_demo: boolean;
};

export async function listLeave(db: Db, opts: { since?: string } = {}): Promise<LeaveRow[]> {
  const { data } = await db
    .from("leave_requests")
    .select("id, employee_id, kind, start_date, end_date, days, reason, status, decision_note, is_demo, employee:employees(full_name), decider:profiles!leave_requests_decided_by_fkey(full_name)")
    .is("deleted_at", null)
    .gte("end_date", opts.since ?? shiftDate(todayDubai(), -365))
    .order("start_date", { ascending: false })
    .returns<(Omit<LeaveRow, "employee" | "decided_by"> & { employee: { full_name: string } | null; decider: { full_name: string } | null })[]>();
  return (data ?? []).map((r) => ({ ...r, employee: r.employee?.full_name ?? "—", decided_by: r.decider?.full_name ?? null }));
}

export async function requestLeave(db: Db, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = leaveRequestSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data: overlap } = await db
    .from("leave_requests")
    .select("id")
    .eq("employee_id", p.data.employee_id)
    .in("status", ["pending", "approved"])
    .is("deleted_at", null)
    .lte("start_date", p.data.end_date)
    .gte("end_date", p.data.start_date)
    .limit(1);
  if (overlap?.length) return { ok: false, error: "That overlaps another request.", fieldErrors: { start_date: "Overlaps existing leave" } };
  const { data, error } = await db.from("leave_requests").insert({ ...p.data, status: "pending" }).select("id").single();
  return error ? fail(error) : ok({ id: data.id });
}

export async function decideLeave(db: Db, id: string, decision: "approved" | "rejected" | "cancelled", note?: string): Promise<ActionResult> {
  const { data, error } = await db
    .from("leave_requests")
    .update({ status: decision, ...(note !== undefined ? { decision_note: note.trim() || null } : {}) })
    .eq("id", id)
    .select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : { ok: false, error: "Request not found." };
}

export async function setLeaveBalance(db: Db, input: unknown): Promise<ActionResult> {
  const p = leaveBalanceSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { error } = await db.from("leave_balances").upsert(p.data, { onConflict: "employee_id,year,kind" });
  return error ? fail(error) : ok(undefined);
}

// ---------------------------------------------------------------- checklists

export async function startChecklist(db: Db, employeeId: string, kind: "onboarding" | "offboarding", ownerId: string | null): Promise<ActionResult<{ id: string }>> {
  const { data: e } = await db.from("employees").select("full_name, start_date, end_date").eq("id", employeeId).maybeSingle();
  if (!e) return { ok: false, error: "Employee not found." };
  const anchor = (kind === "onboarding" ? e.start_date : e.end_date) ?? todayDubai();
  const { data: c, error } = await db
    .from("checklists")
    .insert({ employee_id: employeeId, kind, title: `${kind === "onboarding" ? "Onboarding" : "Offboarding"}: ${e.full_name}` })
    .select("id")
    .single();
  if (error) return fail(error);
  const items = CHECKLIST_TEMPLATES[kind].map((t, i) => ({ checklist_id: c.id, position: i + 1, title: t.title, due_date: shiftDate(anchor, t.dueInDays), owner_id: ownerId }));
  const { error: itemsErr } = await db.from("checklist_items").insert(items);
  return itemsErr ? fail(itemsErr) : ok({ id: c.id });
}

export async function toggleChecklistItem(db: Db, itemId: string, done: boolean): Promise<ActionResult> {
  const { data, error } = await db.from("checklist_items").update({ done_at: done ? new Date().toISOString() : null }).eq("id", itemId).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : { ok: false, error: "You can't change that item." };
}

export async function addChecklistItem(db: Db, checklistId: string, title: string, dueDate: string | null, ownerId: string | null): Promise<ActionResult> {
  if (title.trim().length < 2) return { ok: false, error: "Describe the step." };
  const { data: c } = await db.from("checklists").select("items:checklist_items(position)").eq("id", checklistId).maybeSingle().returns<{ items: { position: number }[] }>();
  if (!c) return { ok: false, error: "Checklist not found." };
  const { error } = await db.from("checklist_items").insert({
    checklist_id: checklistId,
    title: title.trim().slice(0, 300),
    due_date: dueDate || null,
    owner_id: ownerId || null,
    position: Math.max(0, ...c.items.map((i) => i.position)) + 1,
  });
  return error ? fail(error) : ok(undefined);
}

/** Checklist items assigned to this person, open first (for "My HR tasks"). */
export async function myChecklistItems(db: Db, userId: string) {
  const { data } = await db
    .from("checklist_items")
    .select("id, title, due_date, done_at, checklist:checklists(id, title, employee_id, deleted_at)")
    .eq("owner_id", userId)
    .is("done_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(20)
    .returns<{ id: string; title: string; due_date: string | null; done_at: string | null; checklist: { id: string; title: string; employee_id: string; deleted_at: string | null } | null }[]>();
  return (data ?? []).filter((i) => i.checklist && !i.checklist.deleted_at);
}

// ---------------------------------------------------------------- payroll (principal)

export async function listPayrollRuns(db: Db) {
  const { data } = await db
    .from("payroll_runs")
    .select("id, period, pay_date, status, wps_status, wps_reference, paid_at, approved_at, is_demo, items:payroll_items(count)")
    .is("deleted_at", null)
    .order("period", { ascending: false })
    .returns<{ id: string; period: string; pay_date: string | null; status: string; wps_status: string; wps_reference: string | null; paid_at: string | null; approved_at: string | null; is_demo: boolean; items: { count: number }[] }[]>();
  return (data ?? []).map((r) => ({ ...r, people: r.items[0]?.count ?? 0 }));
}

export async function createPayrollRun(db: Db, period: string): Promise<ActionResult<{ id: string; employees: number; skipped: string[] }>> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return { ok: false, error: "Choose a month." };
  const { data, error } = await db.rpc("create_payroll_run", { p_period: `${period}-01` });
  if (error?.code === "23505") return { ok: false, error: error.message.replace(/^./, (c) => c.toUpperCase()) + "." };
  if (error) return fail(error);
  return ok(data as { id: string; employees: number; skipped: string[] });
}

export type PayrollLine = {
  item_id: string;
  employee_id: string;
  full_name: string;
  days_paid: number;
  days_in_period: number;
  basic_minor: number;
  allowances_minor: number;
  variable_minor: number;
  deductions_minor: number;
  net_minor: number;
  note: string | null;
};

export async function getPayrollRun(db: Db, id: string) {
  const { data: run } = await db
    .from("payroll_runs")
    .select("id, period, pay_date, currency, status, wps_status, wps_reference, wps_note, approved_at, paid_at, transaction_id, notes, is_demo, approver:profiles!payroll_runs_approved_by_fkey(full_name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
    .returns<{
      id: string;
      period: string;
      pay_date: string | null;
      currency: string;
      status: string;
      wps_status: string;
      wps_reference: string | null;
      wps_note: string | null;
      approved_at: string | null;
      paid_at: string | null;
      transaction_id: string | null;
      notes: string | null;
      is_demo: boolean;
      approver: { full_name: string } | null;
    }>();
  if (!run) return null;
  const { data: lines, error } = await db.rpc("payroll_run_detail", { p_run: id });
  if (error) return null;
  return { run, lines: (lines ?? []) as PayrollLine[] };
}

export async function updatePayrollLine(db: Db, itemId: string, currency: string, input: unknown): Promise<ActionResult> {
  const p = payrollItemSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the amounts.", fieldErrors: fieldErrors(p.error.issues) };
  const { error } = await db.rpc("update_payroll_item", {
    p_item: itemId,
    p_variable_minor: toMinor(p.data.variable, currency),
    p_deductions_minor: toMinor(p.data.deductions, currency),
    p_note: p.data.note ?? "",
  });
  return error ? fail(error) : ok(undefined);
}

export async function setPayrollStatus(
  db: Db,
  runId: string,
  status: "approved" | "draft" | "paid" | "void",
  pay?: { bank_account_id: string; account_id: string; paid_on: string },
): Promise<ActionResult> {
  const { error } = await db.rpc("set_payroll_status", {
    p_run: runId,
    p_status: status,
    p_bank_account: pay?.bank_account_id,
    p_account: pay?.account_id,
    p_paid_on: pay?.paid_on,
  });
  return error ? fail(error) : ok(undefined);
}

export async function setPayrollWps(db: Db, runId: string, status: string, reference?: string, note?: string): Promise<ActionResult> {
  const { error } = await db.rpc("set_payroll_wps", { p_run: runId, p_status: status, p_reference: reference ?? "", p_note: note ?? "" });
  return error ? fail(error) : ok(undefined);
}

export async function setWpsSettings(db: Db, input: unknown): Promise<ActionResult> {
  const p = wpsSettingsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data, error } = await db.from("company").update(p.data).eq("id", true).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : { ok: false, error: "Only a principal can change company details." };
}

/** The WPS Salary Information File for a run, or the list of numbers still missing. */
export async function payrollSif(db: Db, runId: string) {
  const { data, error } = await db.rpc("payroll_wps_data", { p_run: runId });
  if (error || !data) return { ok: false as const, problems: ["Payroll run not found."] };
  const d = data as { period: string; currency: string; employer_id: string | null; employer_bank_code: string | null; rows: (WpsRow & { employee_id: string })[] };
  // Unpaid leave inside the period goes in the EDR "days on leave" field (working days within the month).
  const monthEnd = new Date(Date.UTC(Number(d.period.slice(0, 4)), Number(d.period.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const { data: leave } = await db
    .from("leave_requests")
    .select("employee_id, start_date, end_date")
    .eq("status", "approved")
    .eq("kind", "unpaid")
    .is("deleted_at", null)
    .lte("start_date", monthEnd)
    .gte("end_date", d.period);
  const leaveBy = new Map<string, number>();
  for (const l of leave ?? []) {
    const days = workingDays(l.start_date > d.period ? l.start_date : d.period, l.end_date < monthEnd ? l.end_date : monthEnd);
    leaveBy.set(l.employee_id, (leaveBy.get(l.employee_id) ?? 0) + days);
  }
  return buildSif({ ...d, rows: d.rows.map((r) => ({ ...r, leave_days: leaveBy.get(r.employee_id) ?? 0 })) }, new Date());
}
