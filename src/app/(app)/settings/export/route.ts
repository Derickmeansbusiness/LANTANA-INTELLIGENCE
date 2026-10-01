import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { EXPORT_TABLES, fetchTable, isExportTable, rowsToCsvParts } from "@/server/backup";
import { toCsv } from "@/components/data-table/csv";
import { todayDubai } from "@/lib/dates";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Principal-only backup: ?format=json for every table in one file, or
 * ?format=csv&table=<name> for one table. Logged via log_export().
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isPrincipal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = await createClient();
  const sp = request.nextUrl.searchParams;
  const day = todayDubai();
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

  if (sp.get("format") === "csv") {
    const table = sp.get("table") ?? "";
    if (!isExportTable(table)) return NextResponse.json({ error: "Unknown table" }, { status: 400 });
    const { rows, error } = await fetchTable(db, table);
    if (error) return NextResponse.json({ error: `Couldn't read ${table}` }, { status: 500 });
    const { error: logErr } = await db.rpc("log_export", { p_scope: "csv", p_tables: [table] });
    if (logErr) return NextResponse.json({ error: "Export not allowed" }, { status: 403 });
    const { head, body } = rowsToCsvParts(rows);
    return new NextResponse(toCsv(head, body), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="lantana-${table}-${day}.csv"` },
    });
  }

  const { error: logErr } = await db.rpc("log_export", { p_scope: "json", p_tables: [...EXPORT_TABLES] });
  if (logErr) return NextResponse.json({ error: "Export not allowed" }, { status: 403 });
  const tables: Record<string, unknown[]> = {};
  const problems: Record<string, string> = {};
  for (const t of EXPORT_TABLES) {
    const { rows, error } = await fetchTable(db, t);
    tables[t] = rows;
    if (error) problems[t] = error;
  }
  const body = JSON.stringify(
    {
      format: "lantana-command-backup",
      version: 1,
      exported_at: new Date().toISOString(),
      exported_by: session.email,
      notes: [
        "Rows are as the exporting principal sees them (RLS applies).",
        "Encrypted columns (identity numbers, pay, IBANs) are not included; they can't be read without the Vault key.",
        "Files are not included: document_versions lists each file's storage path and SHA-256. Download the storage bucket separately.",
      ],
      problems,
      tables,
    },
    null,
    1,
  );
  return new NextResponse(body, {
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="lantana-backup-${day}.json"` },
  });
}
