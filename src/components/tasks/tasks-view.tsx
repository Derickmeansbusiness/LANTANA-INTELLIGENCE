"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDaysIcon, FolderKanbanIcon, GanttChartIcon, KanbanSquareIcon, ListIcon, PlusIcon, SunIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import type { SavedView } from "@/components/data-table/types";
import type { TaskRow } from "@/server/tasks";
import { MyDay } from "./my-day";
import { TaskTable } from "./task-table";
import { TaskBoard } from "./task-board";
import { TaskCalendar } from "./task-calendar";
import { Timeline } from "./timeline";
import { MilestoneList, ProjectFormDialog } from "./project-bits";
import { TaskFormDialog } from "./task-form-dialog";

const VIEWS = ["my-day", "list", "board", "calendar", "timeline", "projects"] as const;
type View = (typeof VIEWS)[number];

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  target_date: string | null;
  owner: string | null;
  deal: string | null;
  deal_id: string | null;
  is_demo: boolean;
  milestones: { id: string; name: string; due_date: string | null; status: string }[];
  tasksTotal: number;
  tasksDone: number;
};

export function TasksView({
  tasks,
  projects,
  views,
  userId,
  today,
  canManageProjects,
  people,
  deals,
}: {
  tasks: TaskRow[];
  projects: Project[];
  views: SavedView[];
  userId: string;
  today: string;
  canManageProjects: boolean;
  people: { value: string; label: string }[];
  deals: { value: string; label: string }[];
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view: View = (VIEWS as readonly string[]).includes(sp.get("view") ?? "") ? (sp.get("view") as View) : "my-day";
  const month = /^\d{4}-\d{2}$/.test(sp.get("month") ?? "") ? sp.get("month")! : today.slice(0, 7);
  const [creating, setCreating] = useState(false);
  const [newProject, setNewProject] = useState(false);

  function setView(v: string) {
    const p = new URLSearchParams(sp.toString());
    if (v === "my-day") p.delete("view");
    else p.set("view", v);
    if (v !== "calendar") p.delete("month");
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  const people_ = [...new Set(tasks.map((t) => t.assignee_name).filter(Boolean))] as string[];
  const projectNames = [...new Set(tasks.map((t) => t.project_name).filter(Boolean))] as string[];

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Tasks & Projects"
        description="Everything with an owner and a date. Tasks from deals, contracts and recurring routines land here."
        actions={
          <>
            {canManageProjects && (
              <Button variant="outline" size="sm" onClick={() => setNewProject(true)}>
                <PlusIcon /> Project
              </Button>
            )}
            <Button size="sm" onClick={() => setCreating(true)}>
              <PlusIcon /> New task
            </Button>
          </>
        }
      />
      <Tabs value={view} onValueChange={setView} className="space-y-4">
        <TabsList aria-label="Task views">
          <TabsTrigger value="my-day">
            <SunIcon /> My day
          </TabsTrigger>
          <TabsTrigger value="list">
            <ListIcon /> List
          </TabsTrigger>
          <TabsTrigger value="board">
            <KanbanSquareIcon /> Board
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDaysIcon /> Calendar
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <GanttChartIcon /> Timeline
          </TabsTrigger>
          <TabsTrigger value="projects">
            <FolderKanbanIcon /> Projects
          </TabsTrigger>
        </TabsList>
        {view === "my-day" && <MyDay tasks={tasks} userId={userId} today={today} />}
        {view === "list" && <TaskTable tasks={tasks} views={views} today={today} people={people_} projects={projectNames} />}
        {view === "board" && <TaskBoard tasks={tasks} today={today} />}
        {view === "calendar" && <TaskCalendar tasks={tasks} today={today} month={month} />}
        {view === "timeline" && <Timeline projects={projects} tasks={tasks} today={today} />}
        {view === "projects" &&
          (projects.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              No projects yet. Projects group tasks and milestones, for example a deal&apos;s execution plan.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
              {projects.map((p) => {
                const pct = p.tasksTotal ? Math.round((p.tasksDone / p.tasksTotal) * 100) : 0;
                return (
                  <article key={p.id} className="rounded-lg border bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/tasks/projects/${p.id}`} className="font-medium hover:text-gold-ink">
                        {p.name}
                      </Link>
                      {p.is_demo && <Badge variant="outline">Demo</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.owner ?? "No owner"}
                      {p.deal && ` · ${p.deal}`}
                    </p>
                    <div className="mt-3" aria-label={`${pct}% of tasks done`}>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-gold-soft" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="num mt-1 text-[11px] text-muted-foreground">
                        {p.tasksDone}/{p.tasksTotal} tasks done
                      </p>
                    </div>
                    <div className="mt-3 border-t pt-3">
                      <MilestoneList projectId={p.id} milestones={p.milestones} today={today} canEdit={false} />
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
      </Tabs>
      <TaskFormDialog open={creating} onOpenChange={setCreating} initial={{ assignee_id: userId }} onSaved={() => router.refresh()} />
      {canManageProjects && <ProjectFormDialog open={newProject} onOpenChange={setNewProject} people={people} deals={deals} />}
    </div>
  );
}
