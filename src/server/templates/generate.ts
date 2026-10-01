import "server-only";
import type { Db } from "@/lib/supabase/server";
import { fail, type ActionResult } from "@/lib/action-result";
import { fmtDate, todayDubai } from "@/lib/dates";
import { formatMoney, toMajor } from "@/lib/money";
import { checkValues, templateById } from "@/lib/templates/catalog";
import type { Company, Field, InvoiceData, SalaryData } from "@/lib/templates/types";
import type { SessionContext } from "@/server/session";
import { saveGeneratedFile } from "./save";
import { renderTemplatePdf } from "./render-pdf";
import { renderTemplateDocx } from "./render-docx";

async function company(db: Db): Promise<Company> {
  const { data } = await db.from("company").select("legal_name, licence_no, licensing_authority, address_lines, website").single();
  return data ?? { legal_name: "Lantana Vision FZ-LLC", licence_no: null, licensing_authority: "RAKEZ", address_lines: [], website: null };
}

/** Form definition with defaults resolved for the signed-in user; invoice choices from records they can see. */
export async function templateForm(db: Db, id: string, session: SessionContext) {
  const t = templateById(id);
  if (!t) return null;
  const today = todayDubai();
  const fields: Field[] = await Promise.all(
    t.fields.map(async (f) => {
      const def = f.default?.replace("{today}", today).replace("{signatory.name}", session.fullName).replace("{signatory.title}", session.title ?? "");
      if (t.id === "invoice" && f.name === "invoice_id") {
        const { data } = await db
          .from("invoices")
          .select("id, invoice_no, total_minor, currency, issue_date, org:organizations(name)")
          .is("deleted_at", null)
          .neq("status", "void")
          .order("issue_date", { ascending: false })
          .returns<{ id: string; invoice_no: string; total_minor: number; currency: string; issue_date: string; org: { name: string } | null }[]>();
        return {
          ...f,
          default: def,
          options: (data ?? []).map((i) => ({
            value: i.id,
            label: `${i.invoice_no} · ${i.org?.name ?? "No client"} · ${formatMoney(toMajor(i.total_minor, i.currency), i.currency)} · ${fmtDate(i.issue_date)}`,
          })),
        };
      }
      if (t.id === "salary_certificate" && f.name === "employee_id") {
        // Principal-only RLS: anyone else gets no rows (and the page blocks them anyway).
        const { data } = await db
          .from("payroll_items")
          .select("employee_id, employee:employees(full_name), run:payroll_runs!inner(status, period)")
          .eq("run.status", "paid")
          .returns<{ employee_id: string; employee: { full_name: string } | null; run: { status: string; period: string } }[]>();
        const seen = new Map<string, string>();
        for (const r of data ?? []) if (!seen.has(r.employee_id)) seen.set(r.employee_id, r.employee?.full_name ?? "Unnamed");
        return { ...f, default: def, options: [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)) };
      }
      return { ...f, default: def };
    }),
  );
  return { id: t.id, name: t.name, description: t.description, unavailable: t.unavailable ?? null, managerOnly: Boolean(t.managerOnly), principalOnly: Boolean(t.principalOnly), fields };
}

async function loadInvoice(db: Db, id: string): Promise<InvoiceData | null> {
  const { data } = await db
    .from("invoices")
    .select(
      "invoice_no, kind, issue_date, due_date, currency, subtotal_minor, vat_rate, vat_minor, total_minor, status, reference, " +
        "org:organizations(name, country_info:countries(name)), deal:deals(name), items:invoice_items(position, description, quantity, unit_price_minor, amount_minor)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{
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
      reference: string | null;
      org: { name: string; country_info: { name: string } | null } | null;
      deal: { name: string } | null;
      items: { position: number; description: string; quantity: number; unit_price_minor: number; amount_minor: number }[];
    }>();
  if (!data) return null;
  return {
    invoice_no: data.invoice_no,
    kind: data.kind,
    issue_date: data.issue_date,
    due_date: data.due_date,
    currency: data.currency,
    total: formatMoney(toMajor(data.total_minor, data.currency), data.currency),
    status: data.status,
    bill_to: data.org?.name ?? "—",
    bill_to_country: data.org?.country_info?.name ?? null,
    deal: data.deal?.name ?? null,
    reference: data.reference,
    lines: [...data.items]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        description: l.description,
        quantity: String(Number(l.quantity)),
        unit_price: formatMoney(toMajor(l.unit_price_minor, data.currency), data.currency),
        amount: formatMoney(toMajor(l.amount_minor, data.currency), data.currency),
      })),
    subtotal: data.subtotal_minor != null ? formatMoney(toMajor(data.subtotal_minor, data.currency), data.currency) : undefined,
    vat: Number(data.vat_rate) > 0 ? { rate: String(Number(data.vat_rate)), amount: formatMoney(toMajor(data.vat_minor, data.currency), data.currency) } : null,
  };
}

/** Salary certificate figures: the latest PAID payroll record only (principal-only function, audited). */
async function loadSalary(db: Db, employeeId: string): Promise<SalaryData | null> {
  const { data, error } = await db.rpc("salary_certificate_data", { p_employee: employeeId });
  if (error || !data) return null;
  const r = data as { full_name: string; job_title: string | null; start_date: string | null; nationality: string | null; passport_no: string | null; period: string; currency: string; basic_minor: number; allowances_minor: number };
  const { data: country } = r.nationality ? await db.from("countries").select("name").eq("code", r.nationality).maybeSingle() : { data: null };
  const m = (minor: number) => formatMoney(toMajor(minor, r.currency), r.currency);
  return {
    full_name: r.full_name,
    job_title: r.job_title,
    start_date: r.start_date,
    nationality: country?.name ?? r.nationality,
    passport_no: r.passport_no,
    period: fmtDate(r.period, "MMMM yyyy"),
    basic: m(r.basic_minor),
    allowances: m(r.allowances_minor),
    gross: m(r.basic_minor + r.allowances_minor),
  };
}

export type GenerateInput = {
  templateId: string;
  values: Record<string, unknown>;
  format: "pdf" | "docx";
  draft: boolean;
  links: { entity_type: "deal" | "organization" | "contract" | "project" | "employee"; entity_id: string }[];
};

/**
 * Render a template on letterhead and save it into the vault as a new draft
 * document (version 1), under the caller's own permissions throughout.
 */
export async function generateFromTemplate(db: Db, session: SessionContext, input: GenerateInput): Promise<ActionResult<{ id: string; versionId: string }>> {
  const t = templateById(input.templateId);
  if (!t) return fail("Unknown template.");
  if (t.unavailable) return fail(t.unavailable);
  if (t.managerOnly && !session.isManagerPlus) return fail("Only a manager or principal can use this template.");
  if (t.principalOnly && !session.isPrincipal) return fail("Only a principal (with two-step sign-in) can use this template.");
  const { values, errors } = checkValues(t, input.values ?? {});
  if (Object.keys(errors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors: errors };

  let invoice: InvoiceData | undefined;
  if (t.id === "invoice") {
    invoice = (await loadInvoice(db, values.invoice_id)) ?? undefined;
    if (!invoice) return { ok: false, error: "Invoice not found.", fieldErrors: { invoice_id: "Choose an invoice" } };
  }

  let salary: SalaryData | undefined;
  const links = (input.links ?? []).slice(0, 20);
  if (t.id === "salary_certificate") {
    salary = (await loadSalary(db, values.employee_id)) ?? undefined;
    if (!salary) return { ok: false, error: "No paid payroll run for this person yet.", fieldErrors: { employee_id: "Choose someone who has been paid" } };
    links.push({ entity_type: "employee", entity_id: values.employee_id });
  }

  const co = await company(db);
  const built = t.build(values, { company: co, today: todayDubai(), signatory: { name: values.signatory_name ?? session.fullName, title: values.signatory_title ?? session.title ?? "" }, invoice, salary });
  const format = input.format === "docx" ? "docx" : "pdf";
  const render = format === "pdf" ? renderTemplatePdf : renderTemplateDocx;
  const buf = Buffer.from(await render({ title: built.title, blocks: built.blocks, address: co.address_lines, draft: input.draft !== false }));

  return saveGeneratedFile(db, {
    title: built.title,
    docType: t.docType,
    confidentiality: t.confidentiality,
    status: "draft",
    description: `Generated from the ${t.name} template on ${fmtDate(todayDubai())}. Template wording: have counsel review before signature.`,
    tags: ["Template"],
    links,
    format,
    buf,
    note: `Generated from template (${format.toUpperCase()})`,
  });
}
