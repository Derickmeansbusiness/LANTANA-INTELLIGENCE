import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { Db } from "@/lib/supabase/server";

/** One row per API call, so cost is visible per person in Settings. Never throws. */
export async function logUsage(
  db: Db,
  kind: "chat" | "briefing" | "clause_review" | "ocr",
  msg: Pick<Anthropic.Beta.BetaMessage, "model" | "usage">,
  threadId: string | null = null,
) {
  const u = msg.usage;
  const { error } = await db.from("agent_usage").insert({
    kind,
    model: msg.model,
    thread_id: threadId,
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_read_tokens: u.cache_read_input_tokens ?? 0,
    cache_write_tokens: u.cache_creation_input_tokens ?? 0,
  });
  if (error) console.error("usage log failed", error.message);
}
