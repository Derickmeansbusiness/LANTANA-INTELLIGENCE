import "server-only";

/**
 * Embeddings come from the `embed` Supabase Edge Function (gte-small, 384
 * dimensions, built into Supabase's edge runtime, so it's free). The call
 * carries the user's own access token; the function rejects anonymous calls.
 * Returns null when the function isn't reachable (e.g. local dev without the
 * model), and search falls back to full-text only.
 */
export async function embedTexts(texts: string[], accessToken: string): Promise<number[][] | null> {
  if (!texts.length) return [];
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`;
  const out: number[][] = [];
  try {
    for (let i = 0; i < texts.length; i += 16) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
        body: JSON.stringify({ input: texts.slice(i, i + 16) }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { embeddings?: number[][] };
      if (!body.embeddings || body.embeddings.length !== Math.min(16, texts.length - i)) return null;
      out.push(...body.embeddings);
    }
    return out;
  } catch {
    return null;
  }
}

export const toPgVector = (v: number[]) => `[${v.map((x) => Number(x.toFixed(6))).join(",")}]`;
