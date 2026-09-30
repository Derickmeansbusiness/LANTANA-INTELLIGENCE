"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/form-field";
import { PRIORITIES, RECURRENCES, TASK_STATUSES } from "@/lib/schemas/tasks";
import { createTaskAction, getTaskFormOptionsAction, updateTaskAction, type TaskFormOptions } from "@/server/actions/tasks";
import { PRIORITY_LABEL, STATUS_LABEL } from "./labels";

export type TaskFormValues = {
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  assignee_id: string;
  project_id: string;
  milestone_id: string;
  deal_id: string;
  organization_id: string;
  recurrence_rule: string;
};

const EMPTY: TaskFormValues = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  due_date: "",
  assignee_id: "",
  project_id: "",
  milestone_id: "",
  deal_id: "",
  organization_id: "",
  recurrence_rule: "",
};

let cachedOptions: Promise<TaskFormOptions> | null = null;
export function loadTaskOptions(force = false) {
  if (force || !cachedOptions) cachedOptions = getTaskFormOptionsAction();
  return cachedOptions;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  taskId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taskId?: string;
  initial?: Partial<TaskFormValues>;
  onSaved?: (id?: string) => void;
}) {
  const [options, setOptions] = useState<TaskFormOptions | null>(null);
  const [v, setV] = useState<TaskFormValues>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof TaskFormValues, val: string) => setV((s) => ({ ...s, [k]: val }));

  useEffect(() => {
    if (open) loadTaskOptions().then(setOptions);
  }, [open]);

  const milestones = options?.projects.find((p) => p.value === v.project_id)?.milestones ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setErrors({}))}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{taskId ? "Edit task" : "New task"}</DialogTitle>
        <DialogDescription className="mt-1">Give it an owner and a date, or it won&apos;t show up where people look.</DialogDescription>
        {!options ? (
          <Skeleton className="mt-5 h-64 w-full" />
        ) : (
          <form
            noValidate
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = taskId ? await updateTaskAction(taskId, v) : await createTaskAction(v);
                if (!r.ok) {
                  setErrors(r.fieldErrors ?? {});
                  return void toast.error(r.error);
                }
                toast.success(taskId ? "Task updated" : "Task created");
                onOpenChange(false);
                if (!taskId) setV({ ...EMPTY, ...initial });
                onSaved?.(r.data && typeof r.data === "object" && "id" in r.data ? (r.data as { id: string }).id : taskId);
              });
            }}
          >
            <FormField label="Title" htmlFor="task-title" error={errors.title} className="sm:col-span-2">
              <Input id="task-title" value={v.title} onChange={(e) => set("title", e.target.value)} aria-invalid={!!errors.title} autoFocus required maxLength={300} />
            </FormField>
            <FormField label="Assignee" htmlFor="task-assignee">
              <NativeSelect id="task-assignee" value={v.assignee_id} onChange={(e) => set("assignee_id", e.target.value)}>
                <option value="">Unassigned</option>
                {options.people.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Due" htmlFor="task-due" error={errors.due_date}>
              <Input id="task-due" type="date" value={v.due_date} onChange={(e) => set("due_date", e.target.value)} className="num" />
            </FormField>
            <FormField label="Priority" htmlFor="task-priority">
              <NativeSelect id="task-priority" value={v.priority} onChange={(e) => set("priority", e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Status" htmlFor="task-status">
              <NativeSelect id="task-status" value={v.status} onChange={(e) => set("status", e.target.value)}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Project" htmlFor="task-project">
              <NativeSelect id="task-project" value={v.project_id} onChange={(e) => (set("project_id", e.target.value), set("milestone_id", ""))}>
                <option value="">None</option>
                {options.projects.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Milestone" htmlFor="task-milestone">
              <NativeSelect id="task-milestone" value={v.milestone_id} onChange={(e) => set("milestone_id", e.target.value)} disabled={!milestones.length}>
                <option value="">{milestones.length ? "None" : "Pick a project with milestones"}</option>
                {milestones.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Deal" htmlFor="task-deal">
              <NativeSelect id="task-deal" value={v.deal_id} onChange={(e) => set("deal_id", e.target.value)}>
                <option value="">None</option>
                {options.deals.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Organization" htmlFor="task-org">
              <NativeSelect id="task-org" value={v.organization_id} onChange={(e) => set("organization_id", e.target.value)}>
                <option value="">None</option>
                {options.orgs.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Repeats" htmlFor="task-repeat" error={errors.recurrence_rule} hint={v.recurrence_rule ? "Completing it creates the next one." : undefined}>
              <NativeSelect id="task-repeat" value={v.recurrence_rule} onChange={(e) => set("recurrence_rule", e.target.value)}>
                {RECURRENCES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Details" htmlFor="task-desc" className="sm:col-span-2">
              <Textarea id="task-desc" value={v.description} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={5000} />
            </FormField>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2Icon className="animate-spin" />}
                {taskId ? "Save" : "Create task"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
