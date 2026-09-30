import "server-only";
import type { Db } from "@/lib/supabase/server";
import { fail, fieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { milestoneSchema, projectSchema, taskSchema } from "@/lib/schemas/tasks";

/** Tasks, projects, milestones and task detail. RLS-bound. */

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "blocked" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  completed_at: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  project_id: string | null;
  project_name: string | null;
  milestone_id: string | null;
  deal_id: string | null;
  deal_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  recurrence_rule: string | null;
  source: string;
  created_at: string;
  checklist_total: number;
  checklist_done: number;
  open_blockers: number;
  is_demo: boolean;
};

const TASK_SELECT =
  "id, title, description, status, priority, due_date, completed_at, assignee_id, project_id, milestone_id, deal_id, organization_id, recurrence_rule, source, created_at, is_demo, " +
  "assignee:profiles!tasks_assignee_id_fkey(full_name), project:projects(name), deal:deals(name), org:organizations(name), " +
  "checklist:task_checklist_items(done), deps:task_dependencies!task_dependencies_task_id_fkey(blocker:tasks!task_dependencies_depends_on_id_fkey(status))";

type RawTask = Omit<TaskRow, "assignee_name" | "project_name" | "deal_name" | "organization_name" | "checklist_total" | "checklist_done" | "open_blockers"> & {
  assignee: { full_name: string } | null;
  project: { name: string } | null;
  deal: { name: string } | null;
  org: { name: string } | null;
  checklist: { done: boolean }[];
  deps: { blocker: { status: string } | null }[];
};

function shape(t: RawTask): TaskRow {
  const { assignee, project, deal, org, checklist, deps, ...rest } = t;
  return {
    ...rest,
    assignee_name: assignee?.full_name ?? null,
    project_name: project?.name ?? null,
    deal_name: deal?.name ?? null,
    organization_name: org?.name ?? null,
    checklist_total: checklist?.length ?? 0,
    checklist_done: checklist?.filter((c) => c.done).length ?? 0,
    open_blockers: deps?.filter((d) => d.blocker && !["done", "cancelled"].includes(d.blocker.status)).length ?? 0,
  };
}

export async function listTasks(db: Db, filter: { dealId?: string; projectId?: string; includeDone?: boolean } = {}): Promise<TaskRow[]> {
  let q = db.from("tasks").select(TASK_SELECT).is("deleted_at", null).order("due_date", { nullsFirst: false }).order("created_at");
  if (filter.dealId) q = q.eq("deal_id", filter.dealId);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  if (!filter.includeDone) q = q.neq("status", "cancelled");
  const { data, error } = await q.returns<RawTask[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(shape);
}

export async function getTaskDetail(db: Db, id: string) {
  const [{ data: task }, checklist, comments, blockedBy, blocking] = await Promise.all([
    db.from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle<RawTask>(),
    db.from("task_checklist_items").select("id, label, done, sort_order").eq("task_id", id).order("sort_order").order("created_at"),
    db.from("task_comments").select("id, body, created_at, created_by, author:profiles!task_comments_created_by_fkey(full_name)").eq("task_id", id).is("deleted_at", null).order("created_at"),
    db.from("task_dependencies").select("blocker:tasks!task_dependencies_depends_on_id_fkey(id, title, status)").eq("task_id", id),
    db.from("task_dependencies").select("dependent:tasks!task_dependencies_task_id_fkey(id, title, status)").eq("depends_on_id", id),
  ]);
  if (!task) return null;
  return {
    task: shape(task),
    checklist: checklist.data ?? [],
    comments: comments.data ?? [],
    blockedBy: (blockedBy.data ?? []).map((d) => d.blocker).filter((x): x is { id: string; title: string; status: TaskRow["status"] } => Boolean(x)),
    blocking: (blocking.data ?? []).map((d) => d.dependent).filter((x): x is { id: string; title: string; status: TaskRow["status"] } => Boolean(x)),
  };
}

async function unfinishedBlockers(db: Db, id: string) {
  const { data } = await db.from("task_dependencies").select("blocker:tasks!task_dependencies_depends_on_id_fkey(title, status)").eq("task_id", id);
  return (data ?? []).map((d) => d.blocker).filter((b): b is { title: string; status: TaskRow["status"] } => Boolean(b) && !["done", "cancelled"].includes(b!.status));
}

function taskRow(v: ReturnType<typeof taskSchema.parse>) {
  return {
    title: v.title,
    description: v.description ?? null,
    status: v.status,
    priority: v.priority,
    due_date: v.due_date ?? null,
    assignee_id: v.assignee_id ?? null,
    project_id: v.project_id ?? null,
    milestone_id: v.milestone_id ?? null,
    deal_id: v.deal_id ?? null,
    organization_id: v.organization_id ?? null,
    recurrence_rule: v.recurrence_rule ?? null,
  };
}

export async function createTask(db: Db, input: unknown, source: "manual" | "agent" = "manual"): Promise<ActionResult<{ id: string }>> {
  const p = taskSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data, error } = await db.from("tasks").insert({ ...taskRow(p.data), source }).select("id").single();
  return error ? fail(error) : ok({ id: data.id });
}

export async function updateTask(db: Db, id: string, input: unknown): Promise<ActionResult> {
  const p = taskSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  if (p.data.status === "done") {
    const b = await unfinishedBlockers(db, id);
    if (b.length) return fail(`Still blocked by: ${b.map((x) => x.title).join(", ")}. Finish or remove that dependency first.`);
  }
  const { data, error } = await db.from("tasks").update(taskRow(p.data)).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Task not found or you can't edit it.");
}

export async function setTaskStatus(db: Db, id: string, status: TaskRow["status"]): Promise<ActionResult> {
  if (status === "done") {
    const b = await unfinishedBlockers(db, id);
    if (b.length) return fail(`Still blocked by: ${b.map((x) => x.title).join(", ")}.`);
  }
  const { data, error } = await db.from("tasks").update({ status }).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Task not found or you can't edit it.");
}

export async function setTaskArchived(db: Db, id: string, archived: boolean): Promise<ActionResult> {
  const { data, error } = await db.from("tasks").update({ deleted_at: archived ? new Date().toISOString() : null }).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Task not found or you can't change it.");
}

export async function addChecklistItem(db: Db, taskId: string, labelText: string): Promise<ActionResult> {
  const text = labelText.trim();
  if (!text || text.length > 300) return fail("Checklist items are 1–300 characters.");
  const { count } = await db.from("task_checklist_items").select("id", { count: "exact", head: true }).eq("task_id", taskId);
  const { error } = await db.from("task_checklist_items").insert({ task_id: taskId, label: text, sort_order: (count ?? 0) + 1 });
  return error ? fail(error) : ok(undefined);
}

export async function toggleChecklistItem(db: Db, id: string, done: boolean): Promise<ActionResult> {
  const { data, error } = await db.from("task_checklist_items").update({ done }).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Item not found.");
}

export async function removeChecklistItem(db: Db, id: string): Promise<ActionResult> {
  const { error } = await db.from("task_checklist_items").delete().eq("id", id);
  return error ? fail(error) : ok(undefined);
}

export async function addComment(db: Db, taskId: string, body: string): Promise<ActionResult> {
  const text = body.trim();
  if (!text || text.length > 5000) return fail("Comments are 1–5000 characters.");
  const { data: claims } = await db.auth.getClaims();
  const { error } = await db.from("task_comments").insert({ task_id: taskId, body: text, created_by: claims?.claims?.sub });
  return error ? fail(error) : ok(undefined);
}

export async function addDependency(db: Db, taskId: string, dependsOnId: string): Promise<ActionResult> {
  if (taskId === dependsOnId) return fail("A task can't depend on itself.");
  // Refuse cycles: walk what dependsOnId already waits on.
  const seen = new Set<string>([dependsOnId]);
  let frontier = [dependsOnId];
  for (let depth = 0; depth < 20 && frontier.length; depth++) {
    const { data } = await db.from("task_dependencies").select("depends_on_id").in("task_id", frontier);
    frontier = [];
    for (const d of data ?? []) {
      if (d.depends_on_id === taskId) return fail("That would create a circular dependency.");
      if (!seen.has(d.depends_on_id)) {
        seen.add(d.depends_on_id);
        frontier.push(d.depends_on_id);
      }
    }
  }
  const { error } = await db.from("task_dependencies").insert({ task_id: taskId, depends_on_id: dependsOnId });
  return error ? fail(error) : ok(undefined);
}

export async function removeDependency(db: Db, taskId: string, dependsOnId: string): Promise<ActionResult> {
  const { error } = await db.from("task_dependencies").delete().eq("task_id", taskId).eq("depends_on_id", dependsOnId);
  return error ? fail(error) : ok(undefined);
}

// ----------------------------------------------------------------- projects

export async function listProjects(db: Db) {
  const { data, error } = await db
    .from("projects")
    .select("id, name, description, status, start_date, target_date, deal_id, is_demo, owner:profiles!projects_owner_id_fkey(full_name), deal:deals(name), milestones(id, name, due_date, status, deleted_at), tasks(id, status, deleted_at)")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => {
    const tasks = (p.tasks ?? []).filter((t) => !t.deleted_at && t.status !== "cancelled");
    const milestones = (p.milestones ?? []).filter((m) => !m.deleted_at).sort((a, b) => (a.due_date ?? "9").localeCompare(b.due_date ?? "9"));
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      start_date: p.start_date,
      target_date: p.target_date,
      is_demo: p.is_demo,
      owner: p.owner?.full_name ?? null,
      deal: p.deal?.name ?? null,
      deal_id: p.deal_id,
      milestones,
      tasksTotal: tasks.length,
      tasksDone: tasks.filter((t) => t.status === "done").length,
    };
  });
}

export async function createProject(db: Db, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = projectSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error.issues) };
  const { data, error } = await db
    .from("projects")
    .insert({
      name: p.data.name,
      description: p.data.description ?? null,
      deal_id: p.data.deal_id ?? null,
      owner_id: p.data.owner_id ?? null,
      status: p.data.status,
      start_date: p.data.start_date ?? null,
      target_date: p.data.target_date ?? null,
    })
    .select("id")
    .single();
  return error ? fail(error) : ok({ id: data.id });
}

export async function addMilestone(db: Db, input: unknown): Promise<ActionResult> {
  const p = milestoneSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Invalid milestone");
  const { error } = await db.from("milestones").insert({ project_id: p.data.project_id, name: p.data.name, due_date: p.data.due_date ?? null });
  return error ? fail(error) : ok(undefined);
}

export async function setMilestoneDone(db: Db, id: string, done: boolean): Promise<ActionResult> {
  const { data, error } = await db.from("milestones").update({ status: done ? "done" : "open" }).eq("id", id).select("id");
  if (error) return fail(error);
  return data?.length ? ok(undefined) : fail("Only the project owner or a manager can change milestones.");
}
