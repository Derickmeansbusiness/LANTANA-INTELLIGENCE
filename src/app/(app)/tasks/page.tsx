import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { todayDubai } from "@/lib/dates";
import { getSession } from "@/server/session";
import { listProjects, listTasks } from "@/server/tasks";
import { peopleOptions } from "@/server/lookups";
import { listViews } from "@/server/actions/views";
import { TasksView } from "@/components/tasks/tasks-view";

export const metadata: Metadata = { title: "Tasks & Projects" };

export default async function TasksPage() {
  const session = await getSession();
  const db = await createClient();
  const [tasks, projects, views, people, deals] = await Promise.all([
    listTasks(db, { includeDone: true }),
    listProjects(db),
    listViews("tasks"),
    peopleOptions(db),
    db.from("deals").select("id, name").is("deleted_at", null).order("name"),
  ]);
  return (
    <Suspense>
      <TasksView
        tasks={tasks}
        projects={projects}
        views={views}
        userId={session.userId}
        today={todayDubai()}
        canManageProjects={session.isManagerPlus}
        people={people}
        deals={(deals.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
      />
    </Suspense>
  );
}
