import "server-only";
import type { Db } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { SessionContext } from "@/server/session";
import { createTask, setTaskArchived, setTaskStatus } from "@/server/tasks";
import { addNote, logInteraction, setOrganizationArchived } from "@/server/relationships";
import { moveDealStage, setDealArchived } from "@/server/deals";
import { addObligation, setContractArchived } from "@/server/contracts";
import { setDocumentArchived } from "@/server/documents";
import { generateFromTemplate } from "@/server/templates/generate";
import { PROPOSAL_TTL_HOURS } from "./config";
import { href, type ToolCtx } from "./tools";

export type ActionRow = {
  id: string;
  tool: string;
  summary: string;
  preview: Record<string, unknown>;
  status: "proposed" | "executed" | "rejected" | "failed" | "expired";
  result: { href?: string; message?: string } | null;
  error: string | null;
  created_at: string;
};

export async function createProposal(ctx: ToolCtx, tool: string, payload: unknown, summary: string, preview: Record<string, unknown>) {
  const { data, error } = await ctx.db
    .from("agent_actions")
    .insert({ thread_id: ctx.threadId, tool, payload: payload as never, summary: summary.slice(0, 500), preview: preview as never })
    .select("id, tool, summary, preview, status, result, error, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ActionRow;
}

type Exec = (db: Db, session: SessionContext, p: Record<string, unknown>) => Promise<ActionResult<{ href?: string; message?: string; versionId?: string }>>;

const asResult = <T,>(r: ActionResult<T>, hrefOk?: (d: T) => string | undefined, message?: string): ActionResult<{ href?: string; message?: string }> =>
  r.ok ? ok({ href: hrefOk?.(r.data), message }) : r;

/** One executor per write tool. Each calls the same domain function the UI uses. */
const EXECUTORS: Record<string, Exec> = {
  create_task: async (db, _s, p) => asResult(await createTask(db, p, "agent"), (d) => href("task", d.id), "Task created"),
  update_task_status: async (db, _s, p) => asResult(await setTaskStatus(db, p.task_id as string, p.status as never), () => href("task", p.task_id as string), "Status updated"),
  add_note: async (db, _s, p) =>
    asResult(await addNote(db, { entityType: p.entity_type, entityId: p.entity_id, body: p.body, pinned: false }), () => href(p.entity_type as string, p.entity_id as string), "Note added"),
  log_interaction: async (db, _s, p) =>
    asResult(await logInteraction(db, p), () => (p.organization_id ? href("organization", p.organization_id as string) : href("deal", p.deal_id as string)), "Interaction logged"),
  move_deal_stage: async (db, _s, p) => asResult(await moveDealStage(db, { dealId: p.deal_id, stage: p.stage, note: p.note ?? null }), () => href("deal", p.deal_id as string), "Deal moved"),
  add_obligation: async (db, _s, p) => asResult(await addObligation(db, p), () => href("contract", p.contract_id as string), "Obligation added"),
  generate_document: async (db, s, p) => {
    const r = await generateFromTemplate(db, s, { templateId: p.template_id as string, values: (p.values ?? {}) as Record<string, unknown>, format: (p.format as "pdf" | "docx") ?? "pdf", draft: true, links: (p.links ?? []) as never });
    return r.ok ? ok({ href: href("document", r.data.id), message: "Saved to the vault as a draft", versionId: r.data.versionId }) : r;
  },
  archive_record: async (db, _s, p) => {
    const id = p.id as string;
    const r =
      p.type === "task"
        ? await setTaskArchived(db, id, true)
        : p.type === "deal"
          ? await setDealArchived(db, id, true)
          : p.type === "organization"
            ? await setOrganizationArchived(db, id, true)
            : p.type === "document"
              ? await setDocumentArchived(db, id, true)
              : await setContractArchived(db, id, true);
    return asResult(r, undefined, "Archived");
  },
};

/**
 * Execute a proposal the user confirmed. Runs under the confirming user's
 * JWT *now*, so a role change since the proposal was made is respected; the
 * domain layer validates the payload again. The outcome lands on the row.
 */
export async function confirmProposal(db: Db, session: SessionContext, id: string): Promise<ActionResult<{ action: ActionRow; versionId?: string }>> {
  const { data: a } = await db.from("agent_actions").select("id, tool, payload, status, created_at, user_id").eq("id", id).maybeSingle();
  if (!a || a.user_id !== session.userId) return fail("Proposal not found.");
  if (a.status !== "proposed") return fail(`This proposal was already ${a.status}.`);
  if (Date.now() - new Date(a.created_at).getTime() > PROPOSAL_TTL_HOURS * 3_600_000) {
    await db.from("agent_actions").update({ status: "expired" }).eq("id", id);
    return fail("This proposal is more than a day old. Ask again so it's checked against current data.");
  }
  const exec = EXECUTORS[a.tool];
  if (!exec) return fail("Unknown action.");

  let outcome: Awaited<ReturnType<Exec>>;
  try {
    outcome = await exec(db, session, a.payload as Record<string, unknown>);
  } catch (e) {
    outcome = fail(e instanceof Error ? e.message : "Something went wrong");
  }
  const patch = outcome.ok
    ? { status: "executed" as const, result: { href: outcome.data.href, message: outcome.data.message } }
    : { status: "failed" as const, error: outcome.error.slice(0, 1000) };
  const { data: row, error } = await db.from("agent_actions").update(patch).eq("id", id).select("id, tool, summary, preview, status, result, error, created_at").single();
  if (error) return fail(error);
  await db.rpc("log_event", { p_action: "agent_action", p_table: "agent_actions", p_row_id: id, p_context: { tool: a.tool, outcome: patch.status } });
  if (!outcome.ok) return fail(outcome.error);
  return ok({ action: row as unknown as ActionRow, versionId: outcome.data.versionId });
}

export async function rejectProposal(db: Db, session: SessionContext, id: string): Promise<ActionResult<{ action: ActionRow }>> {
  const { data, error } = await db
    .from("agent_actions")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("user_id", session.userId)
    .eq("status", "proposed")
    .select("id, tool, summary, preview, status, result, error, created_at");
  if (error) return fail(error);
  if (!data?.length) return fail("Proposal not found or already decided.");
  return ok({ action: data[0] as unknown as ActionRow });
}

/** Decisions made since the model last spoke, so the next turn knows what happened. */
export async function decisionsSince(db: Db, threadId: string, since: string) {
  const { data } = await db
    .from("agent_actions")
    .select("summary, status, error, result")
    .eq("thread_id", threadId)
    .neq("status", "proposed")
    .gt("decided_at", since)
    .order("decided_at");
  if (!data?.length) return null;
  return data
    .map((d) => {
      const r = d.result as { href?: string } | null;
      return `- ${d.summary}: ${d.status}${d.error ? ` (${d.error})` : ""}${r?.href ? ` → ${r.href}` : ""}`;
    })
    .join("\n");
}
