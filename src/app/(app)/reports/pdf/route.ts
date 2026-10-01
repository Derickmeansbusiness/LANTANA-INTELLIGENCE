import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { buildReport, logRun, reportFileTitle, reportPdf, resolveSpec } from "@/server/reports";
import { safeFileName } from "@/lib/schemas/documents";

export const runtime = "nodejs";

/**
 * Download a report as a PDF on the letterhead, built now under the reader's
 * session. Unlike the vault copy this may include cash for a principal, so
 * it is never stored; the download is logged in the audit trail.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isManagerPlus) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = await createClient();
  const sp = request.nextUrl.searchParams;
  const spec = await resolveSpec(db, {
    pack: sp.get("pack") ?? undefined,
    report: sp.get("report") ?? undefined,
    schedule: sp.get("schedule") ?? undefined,
    period: sp.get("period") ?? undefined,
    sections: sp.get("sections") ?? undefined,
  });
  if (!spec) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const report = await buildReport(db, session, spec);
  const buf = await reportPdf(db, report);
  await Promise.all([
    logRun(db, spec, report, null),
    db.rpc("log_event", {
      p_action: "export",
      p_table: "reports",
      p_row_id: spec.reportId ?? spec.pack ?? "custom",
      p_context: { format: "pdf", period_from: report.from, period_to: report.to, sections: report.sections.map((s) => s.key) },
    }),
  ]);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFileName(reportFileTitle(report)).replace(/\.+$/, "")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
