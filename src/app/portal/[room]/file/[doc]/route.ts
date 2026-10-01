import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { watermark } from "@/server/documents/watermark";
import { fmtDubai } from "@/lib/dates";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Stream one data-room file to a guest, watermarked. open_room_document()
 * checks membership, logs the view or download and opens that one storage
 * object to this user for two minutes; the download below runs under the
 * guest's own session. Nothing unmarked leaves the server.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/portal/[room]/file/[doc]">) {
  const { room, doc } = await ctx.params;
  const session = await getSession();
  const notFound = () => new NextResponse("This file isn't available. The room may have closed or the file was removed.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (session.role !== "external" || !UUID.test(room) || !UUID.test(doc)) return notFound();

  const download = request.nextUrl.searchParams.get("download") === "1";
  const db = await createClient();
  const { data } = await db.rpc("open_room_document", { p_room: room, p_document: doc, p_download: download });
  const f = data?.[0];
  if (!f?.storage_path) return notFound();

  const { data: blob, error } = await db.storage.from("documents").download(f.storage_path);
  if (error || !blob) return notFound();

  let body: Uint8Array;
  try {
    body = await watermark(new Uint8Array(await blob.arrayBuffer()), f.mime_type ?? "", {
      recipient: f.viewer_email ?? session.email,
      stamp: `${fmtDubai(new Date(), "d MMM yyyy, HH:mm")} Dubai`,
      title: f.title ?? "Document",
    });
  } catch {
    return notFound();
  }
  const name = `${(f.file_name ?? "document").replace(/\.[^.]+$/, "").replace(/[^\w.\-]+/g, "_")}.pdf`;
  return new NextResponse(Buffer.from(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
