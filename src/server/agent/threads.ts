import "server-only";
import type { Db } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { toolByName } from "./tools";
import type { ChatItem, Part, ProposalView, ThreadSummary } from "./view-types";

type StoredBlock = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown>; tool_use_id?: string; is_error?: boolean; content?: unknown };

export async function listThreads(db: Db, limit = 40): Promise<ThreadSummary[]> {
  const { data } = await db
    .from("agent_threads")
    .select("id, title, pinned, entity_type, entity_id, updated_at")
    .is("deleted_at", null)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ThreadSummary[];
}

/**
 * Rebuild a conversation for display from what was sent to and received from
 * the API: the user's own words (not the injected context), the assistant's
 * text, a chip per tool call, and the proposal or draft each call produced.
 */
export async function getThreadView(db: Db, id: string): Promise<{ thread: ThreadSummary; items: ChatItem[] } | null> {
  const { data: thread } = await db.from("agent_threads").select("id, title, pinned, entity_type, entity_id, updated_at, deleted_at").eq("id", id).maybeSingle();
  if (!thread || thread.deleted_at) return null;
  const [{ data: msgs }, { data: actions }] = await Promise.all([
    db.from("agent_messages").select("role, content").eq("thread_id", id).order("id"),
    db.from("agent_actions").select("id, tool_use_id, tool, summary, preview, status, result, error, created_at").eq("thread_id", id),
  ]);
  const byUse = new Map((actions ?? []).filter((a) => a.tool_use_id).map((a) => [a.tool_use_id!, a as unknown as ProposalView]));

  // Tool outcomes live in the following user message as tool_result blocks.
  const failed = new Set<string>();
  for (const m of msgs ?? []) {
    if (m.role !== "user") continue;
    for (const b of m.content as unknown as StoredBlock[]) if (b.type === "tool_result" && b.is_error && b.tool_use_id) failed.add(b.tool_use_id);
  }

  const items: ChatItem[] = [];
  for (const m of msgs ?? []) {
    const blocks = m.content as unknown as StoredBlock[];
    if (m.role === "user") {
      const said = blocks.filter((b) => b.type === "text" && b.text && !b.text.startsWith("<context>") && !b.text.startsWith("<decisions>"));
      if (said.length) items.push({ role: "user", text: said.map((b) => b.text).join("\n") });
      continue;
    }
    const parts: Part[] = [];
    for (const b of blocks) {
      if (b.type === "text" && b.text) parts.push({ kind: "text", text: b.text });
      if (b.type === "tool_use" && b.id && b.name) {
        const def = toolByName(b.name);
        parts.push({ kind: "tool", id: b.id, name: b.name, label: def?.label ?? b.name, status: failed.has(b.id) ? "error" : "done" });
        const action = byUse.get(b.id);
        if (action) parts.push({ kind: "proposal", action });
        if (b.name === "draft_email" && b.input && !failed.has(b.id)) {
          parts.push({ kind: "draft", to: String(b.input.to ?? ""), subject: String(b.input.subject ?? ""), body: String(b.input.body ?? "") });
        }
      }
    }
    // Consecutive assistant turns (tool rounds) read as one reply.
    const prev = items[items.length - 1];
    if (prev?.role === "assistant") prev.parts.push(...parts);
    else items.push({ role: "assistant", parts });
  }
  return { thread: thread as ThreadSummary, items };
}

export async function updateThread(db: Db, id: string, patch: { title?: string; pinned?: boolean; archived?: boolean }): Promise<ActionResult> {
  const row: { title?: string; pinned?: boolean; deleted_at?: string | null } = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (t.length < 1 || t.length > 200) return fail("Titles are 1–200 characters.");
    row.title = t;
  }
  if (patch.pinned !== undefined) row.pinned = patch.pinned;
  if (patch.archived !== undefined) row.deleted_at = patch.archived ? new Date().toISOString() : null;
  const { data, error } = await db.from("agent_threads").update(row).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Conversation not found.");
}
