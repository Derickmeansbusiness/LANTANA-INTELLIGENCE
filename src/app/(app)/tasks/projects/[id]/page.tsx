import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, todayDubai } from "@/lib/dates";
import { label } from "@/lib/schemas/common";
import { getSession } from "@/server/session";
import { listTasks } from "@/server/tasks";
import { NotesPanel } from "@/components/shared/notes-panel";
import { MilestoneList } from "@/components/tasks/project-bits";
import { TaskLine } from "@/components/tasks/task-bits";
import { ProjectTaskButton } from "@/components/tasks/project-task-button";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/tasks/projects/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await getSession();
  const db = await createClient();
  const { data: p } = await db
    .from("projects")
    .select("id, name, description, status, start_date, target_date, owner_id, is_demo, deleted_at, owner:profiles!projects_owner_id_fkey(full_name), deal:deals(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  const [tasks, milestones, notes] = await Promise.all([
    listTasks(db, { projectId: id, includeDone: true }),
    db.from("milestones").select("id, name, due_date, status").eq("project_id", id).is("deleted_at", null).order("due_date", { nullsFirst: false }),
    db.from("notes").select("id, body, pinned, created_at, author:profiles!notes_created_by_fkey(full_name)").eq("entity_type", "project").eq("entity_id", id).is("deleted_at", null).order("pinned", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  const today = todayDubai();
  const open = tasks.filter((t) => !["done", "cancelled"].includes(t.status));
  const done = tasks.filter((t) => t.status === "done");
  const canEdit = session.isManagerPlus || p.owner_id === session.userId;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <Link href="/tasks?view=projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-3.5" /> Projects
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-[28px]">{p.name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="gold">{label(p.status)}</Badge>
              {p.owner && <Badge variant="outline">{p.owner.full_name}</Badge>}
              {p.deal && (
                <Link href={`/deals/${p.deal.id}`}>
                  <Badge>{p.deal.name}</Badge>
                </Link>
              )}
              {p.is_demo && <Badge variant="warning">Demo</Badge>}
            </div>
            {(p.start_date || p.target_date) && (
              <p className="num mt-2 text-xs text-muted-foreground">
                {fmtDate(p.start_date) || "?"} → {fmtDate(p.target_date) || "?"}
              </p>
            )}
          </div>
          <ProjectTaskButton projectId={id} dealId={p.deal?.id} />
        </div>
      </div>
      {p.description && <p className="max-w-3xl text-sm text-muted-foreground">{p.description}</p>}
      <div className="grid gap-5 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="space-y-5 lg:col-span-8">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Open tasks</CardTitle>
                <CardDescription className="num">
                  {open.length} open · {done.length} done
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {open.length === 0 ? <p className="text-sm text-muted-foreground">No open tasks.</p> : <div className="divide-y">{open.map((t) => <TaskLine key={t.id} task={t} today={today} />)}</div>}
              {done.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Show {done.length} done</summary>
                  <div className="divide-y">{done.map((t) => <TaskLine key={t.id} task={t} today={today} />)}</div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-5 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              <MilestoneList projectId={id} milestones={milestones.data ?? []} today={today} canEdit={canEdit} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <NotesPanel entityType="project" entityId={id} notes={(notes.data ?? []) as never} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
