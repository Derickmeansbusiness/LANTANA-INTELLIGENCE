import "server-only";
import type { Db } from "@/lib/supabase/server";

/**
 * Backup and export, principal only, under the principal's own session (RLS
 * applies, no service-role key). Encrypted columns are never exported: they
 * are useless without the Vault key and the clear values go through the
 * audited reveal functions instead. Derived data (search chunks, cached
 * briefings) and other people's private agent threads are left out.
 */
export const EXPORT_TABLES = [
  "company", "profiles", "user_invites",
  "organizations", "contacts", "interactions", "notes",
  "pipeline_stages", "deals", "deal_members", "deal_parties", "deal_stage_history", "introductions",
  "projects", "milestones", "tasks", "task_checklist_items", "task_comments", "task_dependencies", "saved_views",
  "folders", "tags", "documents", "document_versions", "document_tags", "document_links", "document_share_links", "document_share_views",
  "contracts", "contract_survival_clauses", "contract_obligations",
  "accounts", "bank_accounts", "fx_rates", "transactions", "transaction_imports", "category_rules", "invoices", "invoice_items", "bills", "budgets",
  "employees", "employee_identity", "employee_compensation", "leave_requests", "leave_balances", "checklists", "checklist_items", "payroll_runs", "payroll_items",
  "compliance_items", "corporate_records", "meetings", "resolutions",
  "data_rooms", "data_room_members", "data_room_documents", "data_room_events",
  "reports", "report_schedules", "report_runs",
  "agent_actions", "agent_usage", "clause_reviews", "notifications", "alerts_sent", "activity_events", "audit_log",
] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];

export function isExportTable(t: string): t is ExportTable {
  return (EXPORT_TABLES as readonly string[]).includes(t);
}

/** Columns never exported: ciphertext, search vectors, embeddings. */
export function exportable(column: string) {
  return !/_enc(rypted)?$/.test(column) && column !== "search" && column !== "embedding";
}

const PAGE = 1000;

export async function fetchTable(db: Db, table: ExportTable): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    // Table names come from the fixed list above; the client types can't follow a union here.
    const { data, error } = await (db.from(table as "deals") as unknown as { select: (c: string) => { range: (a: number, b: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> } })
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    for (const r of data ?? []) rows.push(Object.fromEntries(Object.entries(r).filter(([k]) => exportable(k))));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
}

export function rowsToCsvParts(rows: Record<string, unknown>[]) {
  const head = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const body = rows.map((r) => head.map((k) => {
    const v = r[k];
    return v == null ? null : typeof v === "object" ? JSON.stringify(v) : (v as string | number);
  }));
  return { head, body };
}
