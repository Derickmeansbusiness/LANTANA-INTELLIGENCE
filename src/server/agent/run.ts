import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Db } from "@/lib/supabase/server";
import type { SessionContext } from "@/server/session";
import { CHAT_MODEL, fallbackParams, MAX_TOOL_ROUNDS } from "./config";
import { contextBlock, SYSTEM_PROMPT, type PageContext } from "./prompt";
import { apiTools, runRead, toolByName, type ToolCtx } from "./tools";
import { createProposal, decisionsSince, type ActionRow } from "./proposals";
import { logUsage } from "./usage";

type Block = Anthropic.Beta.BetaContentBlockParam;
type Msg = Anthropic.Beta.BetaMessageParam;

/** Events streamed to the browser. */
export type AgentEvent =
  | { type: "thread"; id: string; title: string }
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; label: string; status: "running" | "done" | "error"; detail?: string }
  | { type: "proposal"; action: ActionRow }
  | { type: "draft"; to: string; subject: string; body: string }
  | { type: "error"; message: string }
  | { type: "done" };

const MAX_RESULT_CHARS = 40_000;
const READ_ONLY_TYPES = new Set(["text"]);

/**
 * After a mid-output fallback the content holds the declined model's partial,
 * a `fallback` marker, then the fallback model's output. When echoing it back
 * keep only text from before the marker; everything after echoes as-is.
 */
export function echoable(content: Block[]): Block[] {
  const last = content.findLastIndex((b) => (b as { type: string }).type === "fallback");
  if (last < 0) return content;
  return [...content.slice(0, last).filter((b) => READ_ONLY_TYPES.has(b.type)), ...content.slice(last + 1)];
}

/** Tool calls to run: only those the final (possibly fallback) model made. */
export function toolUsesOf(content: Anthropic.Beta.BetaContentBlock[]) {
  const last = content.findLastIndex((b) => (b as { type: string }).type === "fallback");
  return content.slice(last + 1).filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
}

/** Consecutive messages from the same role are merged (e.g. a stopped tool round followed by a new question). */
export function mergeRoles(msgs: Msg[]): Msg[] {
  const out: Msg[] = [];
  for (const m of msgs) {
    const prev = out[out.length - 1];
    const content = typeof m.content === "string" ? [{ type: "text", text: m.content } as Block] : m.content;
    if (prev && prev.role === m.role) prev.content = [...(prev.content as Block[]), ...content];
    else out.push({ role: m.role, content: [...content] });
  }
  return out;
}

async function store(db: Db, threadId: string, role: "user" | "assistant", content: unknown, model?: string) {
  const { error } = await db.from("agent_messages").insert({ thread_id: threadId, role, content: content as never, model: model ?? null });
  if (error) throw new Error(`Couldn't save the conversation: ${error.message}`);
}

export async function runAgentTurn(opts: {
  db: Db;
  session: SessionContext;
  accessToken: string | null;
  threadId: string | null;
  text: string;
  context: PageContext;
  emit: (e: AgentEvent) => void;
  signal?: AbortSignal;
}) {
  const { db, session, emit } = opts;

  // Thread: reuse or start one, pinned to the open record if there is one.
  let threadId = opts.threadId;
  let lastAt: string | null = null;
  if (threadId) {
    const { data: t } = await db.from("agent_threads").select("id, title").eq("id", threadId).maybeSingle();
    if (!t) return emit({ type: "error", message: "Conversation not found." });
  } else {
    const title = opts.text.replace(/\s+/g, " ").trim().slice(0, 80) || "New conversation";
    const rec = opts.context.record;
    const pinnable = rec && ["deal", "organization", "contact", "task", "contract", "document", "project"].includes(rec.type);
    const { data: t, error } = await db
      .from("agent_threads")
      .insert({ title, entity_type: pinnable ? rec!.type : null, entity_id: pinnable ? rec!.id : null })
      .select("id, title")
      .single();
    if (error) return emit({ type: "error", message: "Couldn't start a conversation." });
    threadId = t.id;
    emit({ type: "thread", id: t.id, title: t.title });
  }

  const { data: history } = await db.from("agent_messages").select("role, content, created_at").eq("thread_id", threadId).order("id");
  lastAt = history?.length ? history[history.length - 1].created_at : null;

  // The new user turn: context, any decisions on earlier proposals, then the question.
  const userContent: Block[] = [{ type: "text", text: contextBlock(session, opts.context) }];
  if (lastAt) {
    const decided = await decisionsSince(db, threadId, lastAt);
    if (decided) userContent.push({ type: "text", text: `<decisions>\nThe user decided on earlier proposals:\n${decided}\n</decisions>` });
  }
  userContent.push({ type: "text", text: opts.text });
  await store(db, threadId, "user", userContent);

  const messages: Msg[] = mergeRoles([
    ...(history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.role === "assistant" ? echoable(m.content as unknown as Block[]) : (m.content as unknown as Block[]) })),
    { role: "user", content: userContent },
  ]);

  const ctx: ToolCtx = { db, session, threadId, accessToken: opts.accessToken };
  const client = new Anthropic();
  const tools = apiTools(session);
  let jsonRetries = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (opts.signal?.aborted) break;
    let message: Anthropic.Beta.BetaMessage;
    try {
      const stream = client.beta.messages.stream(
        {
          model: CHAT_MODEL(),
          max_tokens: 16000,
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          tools,
          messages,
          // Automatic breakpoint for the growing conversation tail.
          cache_control: { type: "ephemeral" },
          ...fallbackParams(),
        },
        { signal: opts.signal },
      );
      for await (const ev of stream) {
        if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") {
          const def = toolByName(ev.content_block.name);
          emit({ type: "tool", id: ev.content_block.id, name: ev.content_block.name, label: def?.label ?? ev.content_block.name, status: "running" });
        } else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
          emit({ type: "text", delta: ev.delta.text });
        }
      }
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (e) {
      if (opts.signal?.aborted) break;
      if (e instanceof Anthropic.APIError) {
        console.error(`agent API error ${e.status}: ${e.message}`);
        emit({ type: "error", message: e.status === 429 || e.status === 529 ? "Ask Lantana is busy. Try again in a minute." : "Ask Lantana couldn't reach the model. Try again." });
        break;
      }
      // A tool input the SDK couldn't parse at all: re-issue the turn, at most twice.
      if (jsonRetries++ < 2) continue;
      throw e;
    }

    await logUsage(db, "chat", message, threadId);
    const content = message.content as unknown as Block[];
    await store(db, threadId, "assistant", content, message.model);
    messages.push({ role: "assistant", content: echoable(content) });

    if (message.stop_reason === "refusal") {
      emit({ type: "error", message: "The model declined to answer that. Try rephrasing." });
      break;
    }
    if (message.stop_reason === "pause_turn") continue;

    const uses = toolUsesOf(message.content);
    if (!uses.length) break;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    if (message.stop_reason === "max_tokens") {
      // A truncated tool input can still look valid: never run it.
      for (const u of uses) results.push({ type: "tool_result", tool_use_id: u.id, is_error: true, content: "Your output was cut off before this call finished. Nothing was run." });
      await store(db, threadId, "user", results);
      emit({ type: "error", message: "That answer ran too long and was cut off. Ask for less at once." });
      break;
    }

    for (const u of uses) results.push(await runTool(ctx, u, emit));
    await store(db, threadId, "user", results);
    messages.push({ role: "user", content: results });
    if (round === MAX_TOOL_ROUNDS - 1) emit({ type: "error", message: "Stopped after several lookups without a final answer. Ask a narrower question." });
  }
  emit({ type: "done" });
}

async function runTool(ctx: ToolCtx, use: Anthropic.Beta.BetaToolUseBlock, emit: (e: AgentEvent) => void): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  const def = toolByName(use.name);
  const err = (msg: string) => {
    emit({ type: "tool", id: use.id, name: use.name, label: def?.label ?? use.name, status: "error", detail: msg });
    return { type: "tool_result" as const, tool_use_id: use.id, is_error: true, content: msg };
  };
  if (!def) return err(`Unknown tool ${use.name}.`);
  if (def.managerOnly && !ctx.session.isManagerPlus) return err("This is available to managers and principals only.");
  const parsed = def.input.safeParse(use.input);
  if (!parsed.success) return err(`Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`);

  try {
    if (def.kind === "read") {
      const out = await runRead(ctx, def, parsed.data);
      const json = JSON.stringify(out);
      emit({ type: "tool", id: use.id, name: use.name, label: def.label, status: "done" });
      return { type: "tool_result", tool_use_id: use.id, content: json.length > MAX_RESULT_CHARS ? json.slice(0, MAX_RESULT_CHARS) + "…(truncated)" : json };
    }
    if (def.kind === "write") {
      const p = await def.propose(ctx, parsed.data as never);
      if ("error" in p) return err(p.error);
      const action = await createProposal(ctx, def.name, parsed.data, p.summary, p.preview);
      emit({ type: "tool", id: use.id, name: use.name, label: def.label, status: "done" });
      emit({ type: "proposal", action });
      return { type: "tool_result", tool_use_id: use.id, content: JSON.stringify({ proposal_id: action.id, status: "awaiting_user_confirmation", summary: p.summary }) };
    }
    const d = parsed.data as { to: string; subject: string; body: string };
    emit({ type: "tool", id: use.id, name: use.name, label: def.label, status: "done" });
    emit({ type: "draft", to: d.to, subject: d.subject, body: d.body });
    return { type: "tool_result", tool_use_id: use.id, content: "The draft is shown to the user to copy. Nothing was sent." };
  } catch (e) {
    console.error("tool failed", use.name, e);
    return err("The lookup failed. Try again or ask differently.");
  }
}
