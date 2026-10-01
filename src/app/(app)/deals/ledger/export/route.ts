import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { chainStatus, listIntroductions } from "@/server/ledger";
import { LedgerPdf } from "@/server/pdf/ledger-pdf";

export const runtime = "nodejs";

/** Dated PDF of the introductions ledger (optionally one deal). RLS decides which rows appear. */
export async function GET(request: NextRequest) {
  // Route handlers skip the (app) layout, so the guest check is repeated here.
  if ((await getSession()).role === "external") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const dealParam = request.nextUrl.searchParams.get("deal");
  const dealId = dealParam && /^[0-9a-f-]{36}$/i.test(dealParam) ? dealParam : undefined;

  const [rows, chain, { data: company }, { data: me }, deal] = await Promise.all([
    listIntroductions(db, { dealId }),
    chainStatus(db),
    db.from("company").select("legal_name, licence_no, address_lines").maybeSingle(),
    db.from("profiles").select("full_name").eq("id", claims.claims.sub).maybeSingle(),
    dealId ? db.from("deals").select("name").eq("id", dealId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (dealId && !deal.data) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const generatedAt = new Date().toISOString();
  const includesDemo = rows.some((r) => r.is_demo);
  const buffer = await renderToBuffer(
    LedgerPdf({
      rows,
      generatedAt,
      generatedBy: me?.full_name ?? "Unknown user",
      scope: deal.data ? `Deal: ${deal.data.name}` : "All introductions you can see",
      chain: chain ? (includesDemo && !rows.some((r) => !r.is_demo) ? chain.demo : chain.real) : null,
      address: [company?.legal_name ?? "Lantana Vision FZ-LLC", ...(company?.address_lines ?? []), company?.licence_no ? `${company.licence_no.includes(",") ? "Licences" : "Licence"} ${company.licence_no}` : ""].filter(Boolean),
    }),
  );

  await db.rpc("log_event", {
    p_action: "export",
    p_table: "introductions",
    p_row_id: dealId ?? "all",
    p_context: { rows: rows.length, format: "pdf", chain_head: chain?.real.head ?? null },
  });

  const filename = `lantana-introductions-${generatedAt.slice(0, 10)}${dealId ? "-deal" : ""}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
