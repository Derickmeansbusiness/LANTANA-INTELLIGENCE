import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { payrollSif } from "@/server/people";

/**
 * Download the WPS Salary Information File for a run. Principal only: the
 * underlying function decrypts IBANs and person codes and logs the read.
 * When numbers are missing, returns a plain-text list of what to add.
 */
export async function GET(_req: Request, ctx: RouteContext<"/people/payroll/[id]/sif">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.isPrincipal || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const r = await payrollSif(await createClient(), id);
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!r.ok) {
    return new Response(`The WPS file can't be produced yet:\n\n- ${r.problems.join("\n- ")}\n`, { status: 422, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(r.content, { headers: { ...headers, "Content-Type": "text/plain; charset=us-ascii", "Content-Disposition": `attachment; filename="${r.fileName}"` } });
}
