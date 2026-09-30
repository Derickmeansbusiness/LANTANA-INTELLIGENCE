// Embeds text with gte-small (384 dims), which ships inside Supabase's edge
// runtime. JWT verification is on (config.toml), so only signed-in users of
// this project can call it.
const session = new Supabase.ai.Session("gte-small");

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
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
