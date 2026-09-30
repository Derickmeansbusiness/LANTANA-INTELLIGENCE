import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { watermark } from "@/server/documents/watermark";
import { fmtDubai } from "@/lib/dates";

/**
 * Public share link. No session: the token is the credential. Every open is
 * logged by open_share_link() (ok, expired, revoked or over the view limit);
 * the file is read through the anon storage window that call opens and is
 * watermarked with the recipient's name before it leaves.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/s/[token]">) {
  const { token } = await ctx.params;
  const gone = (reason: string) => NextResponse.redirect(new URL(`/s/unavailable?r=${reason}`, request.url), 303);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const db = createAnonClient();
  const { data, error } = await db.rpc("open_share_link", {
    p_token: token,
    p_ip_hash: ip ? createHash("sha256").update(`lantana-share:${ip}`).digest("hex").slice(0, 32) : undefined,
    p_user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? undefined,
  });
  const link = data?.[0];
  if (error || !link) return gone("unknown");
  if (!link.ok || !link.storage_path) return gone(link.reason ?? "unknown");

  const { data: blob, error: dlErr } = await db.storage.from("documents").download(link.storage_path);
  if (dlErr || !blob) return gone("error");

  let body: Uint8Array;
  try {
    body = await watermark(new Uint8Array(await blob.arrayBuffer()), link.mime_type ?? "", {
      recipient: link.recipient_name ?? "recipient",
      stamp: `${fmtDubai(new Date(), "d MMM yyyy, HH:mm")} Dubai`,
      title: link.document_title ?? "Document",
    });
  } catch {
    return gone("error");
  }

  const name = (link.file_name ?? "document").replace(/\.[^.]+$/, "") + ".pdf";
  return new NextResponse(Buffer.from(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name.replace(/[^\w.\-]+/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
