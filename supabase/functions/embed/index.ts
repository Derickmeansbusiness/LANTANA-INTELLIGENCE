// Embeds text with gte-small (384 dims), which ships inside Supabase's edge
// runtime. The gateway verifies the JWT signature (verify_jwt = true), but it
// also accepts the public anon key, so we additionally require a signed-in
// user's token (role "authenticated").
const session = new Supabase.ai.Session("gte-small");

function role(req: Request): string | null {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (role(req) !== "authenticated") return Response.json({ error: "Sign in first" }, { status: 403 });
  let input: unknown;
  try {
    input = (await req.json()).input;
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!Array.isArray(input) || input.length === 0 || input.length > 32 || !input.every((t) => typeof t === "string")) {
    return Response.json({ error: "input must be 1–32 strings" }, { status: 400 });
  }
  const embeddings: number[][] = [];
  for (const text of input as string[]) {
    const v = await session.run(text.slice(0, 4000), { mean_pool: true, normalize: true });
    embeddings.push(Array.from(v as ArrayLike<number>));
  }
  return Response.json({ embeddings });
});
