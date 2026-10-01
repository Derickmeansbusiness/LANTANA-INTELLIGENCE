import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Db } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { fmtDate, resolveRange, todayDubai } from "@/lib/dates";
import { briefingFacts } from "@/lib/briefing-facts";
import type { SessionContext } from "@/server/session";
import { getActivity, getAttention, getKpis, getWeek } from "@/server/command-center";
import { agentAvailable, BACKGROUND_MODEL, fallbackParams } from "./config";
import { logUsage } from "./usage";

export type Briefing = { content: string; model: string | null; created_at: string };

const SYSTEM = `You write the morning briefing for one person at Lantana Vision FZ-LLC, a UAE advisory firm that brings Gulf capital to African projects. It is the first thing they read each day in Lantana Command.

Write three to five bullet points, most important first. Each bullet says what needs doing or deciding and why, in one or two sentences. Start with a verb or the subject, never with "You have". Link the record a bullet is about as a markdown link using its href from the facts, e.g. [Faminas mandate](/contracts/…). End with one short line about anything going well, if the facts support it.

Use only the facts provided. Do not add, convert or estimate figures; quote them as given, with currency. If a fact is missing, leave it out rather than guessing. If nothing is urgent, say so plainly in one bullet. No greeting, no sign-off, no headings.`;

export async function getTodaysBriefing(db: Db): Promise<Briefing | null> {
  const { data } = await db.from("briefings").select("content, model, created_at").eq("briefing_date", todayDubai()).maybeSingle();
  return data ?? null;
}

/**
 * Write today's briefing for the signed-in user from facts computed under
 * their own JWT, and cache it for the day. `force` rewrites it.
 */
export async function generateBriefing(db: Db, session: SessionContext, force = false): Promise<ActionResult<Briefing>> {
  if (!agentAvailable()) return fail("The AI briefing needs an Anthropic API key.");
  if (!force) {
    const cached = await getTodaysBriefing(db);
    if (cached) return ok(cached);
  }
  const today = todayDubai();
  const range = resolveRange({}, today);
  const [kpis, attention, activity, week] = await Promise.all([getKpis(range.from, range.to), getAttention(), getActivity(40), getWeek(today)]);
  const facts = briefingFacts({ attention, activity, kpis, week: week.entries, today });

  const client = new Anthropic();
  let message: Anthropic.Beta.BetaMessage;
  try {
    const stream = client.beta.messages.stream({
      model: BACKGROUND_MODEL(),
      max_tokens: 4000,
      output_config: { effort: "low" },
      ...fallbackParams(),
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Reader: ${session.fullName} (${session.isPrincipal ? "principal" : session.role}). Today is ${fmtDate(today, "EEEE d MMMM yyyy")}, Dubai.\n\nFacts:\n${JSON.stringify(facts.items, null, 1)}\n\nSummary lines already shown on the page:\n${facts.lines.map((l) => `- ${l}`).join("\n")}`,
        },
      ],
    });
    message = await stream.finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.APIError) return fail("Couldn't write the briefing right now.");
    throw e;
  }
  await logUsage(db, "briefing", message);
  if (message.stop_reason === "refusal") return fail("The briefing couldn't be written today.");
  const content = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  if (!content) return fail("The briefing came back empty.");

  const { data, error } = await db
    .from("briefings")
    .upsert({ briefing_date: today, content, facts: facts.items as never, model: message.model, created_at: new Date().toISOString() }, { onConflict: "user_id,briefing_date" })
    .select("content, model, created_at")
    .single();
  if (error) return fail(error);
  return ok(data);
}
