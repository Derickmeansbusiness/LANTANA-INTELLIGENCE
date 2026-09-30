"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import * as tasks from "@/server/tasks";
import type { TaskRow } from "@/server/tasks";

function refresh() {
  revalidatePath("/tasks", "layout");
  revalidatePath("/deals", "layout");
  revalidatePath("/");
}

const wrap = <A extends unknown[], R>(fn: (db: Awaited<ReturnType<typeof createClient>>, ...a: A) => Promise<ActionResult<R>>) =>
  async (...a: A): Promise<ActionResult<R>> => {
    const r = await fn(await createClient(), ...a);
    if (r.ok) refresh();
    return r;
  };

export async function createTaskAction(input: unknown) {
  return wrap(tasks.createTask)(input);
}
export async function updateTaskAction(id: string, input: unknown) {
  return wrap(tasks.updateTask)(id, input);
}
export async function setTaskStatusAction(id: string, status: TaskRow["status"]) {
  return wrap(tasks.setTaskStatus)(id, status);
}
export async function setTaskArchivedAction(id: string, archived: boolean) {
  return wrap(tasks.setTaskArchived)(id, archived);
}
export async function addChecklistItemAction(taskId: string, label: string) {
  return wrap(tasks.addChecklistItem)(taskId, label);
}
export async function toggleChecklistItemAction(id: string, done: boolean) {
  return wrap(tasks.toggleChecklistItem)(id, done);
}
export async function removeChecklistItemAction(id: string) {
  return wrap(tasks.removeChecklistItem)(id);
}
export async function addCommentAction(taskId: string, body: string) {
  return wrap(tasks.addComment)(taskId, body);
}
export async function addDependencyAction(taskId: string, dependsOnId: string) {
  return wrap(tasks.addDependency)(taskId, dependsOnId);
}
export async function removeDependencyAction(taskId: string, dependsOnId: string) {
  return wrap(tasks.removeDependency)(taskId, dependsOnId);
}
export async function createProjectAction(input: unknown) {
  return wrap(tasks.createProject)(input);
}
export async function addMilestoneAction(input: unknown) {
  return wrap(tasks.addMilestone)(input);
}
export async function setMilestoneDoneAction(id: string, done: boolean) {
  return wrap(tasks.setMilestoneDone)(id, done);
}

/** Loads task detail for the task sheet. Read-only, RLS-filtered. */
export async function getTaskDetailAction(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return tasks.getTaskDetail(await createClient(), id);
}

export type TaskFormOptions = {
  people: { value: string; label: string }[];
  projects: { value: string; label: string; milestones: { value: string; label: string }[] }[];
  deals: { value: string; label: string }[];
  orgs: { value: string; label: string }[];
  openTasks: { value: string; label: string }[];
};

/** Everything the task form needs, filtered by what the caller may see. */
export async function getTaskFormOptionsAction(): Promise<TaskFormOptions> {
  const db = await createClient();
  const [people, projects, deals, orgs, openTasks] = await Promise.all([
    db.from("profiles").select("id, full_name").eq("is_active", true).neq("role", "external").order("full_name"),
    db.from("projects").select("id, name, milestones(id, name, deleted_at)").is("deleted_at", null).order("name"),
    db.from("deals").select("id, name").is("deleted_at", null).order("name"),
    db.from("organizations").select("id, name").is("deleted_at", null).order("name"),
    db.from("tasks").select("id, title").is("deleted_at", null).not("status", "in", "(done,cancelled)").order("title").limit(500),
  ]);
  return {
    people: (people.data ?? []).map((p) => ({ value: p.id, label: p.full_name })),
    projects: (projects.data ?? []).map((p) => ({
      value: p.id,
      label: p.name,
      milestones: (p.milestones ?? []).filter((m) => !m.deleted_at).map((m) => ({ value: m.id, label: m.name })),
    })),
    deals: (deals.data ?? []).map((d) => ({ value: d.id, label: d.name })),
    orgs: (orgs.data ?? []).map((o) => ({ value: o.id, label: o.name })),
    openTasks: (openTasks.data ?? []).map((t) => ({ value: t.id, label: t.title })),
  };
}
