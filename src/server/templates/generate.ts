import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Db } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { fmtDate, todayDubai } from "@/lib/dates";
import { formatMoney, toMajor } from "@/lib/money";
import { safeFileName } from "@/lib/schemas/documents";
import { checkValues, templateById } from "@/lib/templates/catalog";
import type { Company, Field, InvoiceData } from "@/lib/templates/types";
import type { SessionContext } from "@/server/session";
import { createDocument, registerVersion } from "@/server/documents";
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
      return { ...f, default: def };
    }),
  );
  return { id: t.id, name: t.name, description: t.description, unavailable: t.unavailable ?? null, managerOnly: Boolean(t.managerOnly), fields };
}

async function loadInvoice(db: Db, id: string): Promise<InvoiceData | null> {
  const { data } = await db
    .from("invoices")
    .select("invoice_no, kind, issue_date, due_date, currency, total_minor, status, org:organizations(name, country_info:countries(name)), deal:deals(name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{
      invoice_no: string;
      kind: string;
      issue_date: string;
      due_date: string;
      currency: string;
      total_minor: number;
      status: string;
      org: { name: string; country_info: { name: string } | null } | null;
      deal: { name: string } | null;
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
  };
}

export type GenerateInput = {
  templateId: string;
  values: Record<string, unknown>;
  format: "pdf" | "docx";
  draft: boolean;
  links: { entity_type: "deal" | "organization" | "contract" | "project"; entity_id: string }[];
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
  const { values, errors } = checkValues(t, input.values ?? {});
  if (Object.keys(errors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors: errors };

  let invoice: InvoiceData | undefined;
  if (t.id === "invoice") {
    invoice = (await loadInvoice(db, values.invoice_id)) ?? undefined;
    if (!invoice) return { ok: false, error: "Invoice not found.", fieldErrors: { invoice_id: "Choose an invoice" } };
  }

  const co = await company(db);
  const built = t.build(values, { company: co, today: todayDubai(), signatory: { name: values.signatory_name ?? session.fullName, title: values.signatory_title ?? session.title ?? "" }, invoice });
  const format = input.format === "docx" ? "docx" : "pdf";
  const render = format === "pdf" ? renderTemplatePdf : renderTemplateDocx;
  const buf = Buffer.from(await render({ title: built.title, blocks: built.blocks, address: co.address_lines, draft: input.draft !== false }));

  const created = await createDocument(db, {
    title: built.title.slice(0, 300),
    doc_type: t.docType,
    confidentiality: t.confidentiality,
    status: "draft",
    description: `Generated from the ${t.name} template on ${fmtDate(todayDubai())}. Template wording: have counsel review before signature.`,
    tags: ["Template"],
    links: (input.links ?? []).slice(0, 20),
  });
  if (!created.ok) return created;

  const fileName = `${safeFileName(built.title).replace(/\.+$/, "")}.${format}`;
  const path = `${created.data.id}/${randomUUID()}/${fileName}`;
  const mime = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const { error: upErr } = await db.storage.from("documents").upload(path, buf, { contentType: mime, upsert: false });
  if (upErr) return fail("The document was created but its file couldn't be saved. Try generating again.");
  const v = await registerVersion(db, {
    documentId: created.data.id,
    storagePath: path,
    fileName,
    mimeType: mime,
    sizeBytes: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex"),
    note: `Generated from template (${format.toUpperCase()})`,
  });
  if (!v.ok) return v;
  return ok({ id: created.data.id, versionId: v.data.versionId });
}
