"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DiamondIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/dates";
import { addMilestoneAction, createProjectAction, setMilestoneDoneAction } from "@/server/actions/tasks";

type Opt = { value: string; label: string };
export type MilestoneItem = { id: string; name: string; due_date: string | null; status: string };

export function MilestoneList({ projectId, milestones, today, canEdit }: { projectId: string; milestones: MilestoneItem[]; today: string; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  return (
    <div>
      <ul className="space-y-1.5">
        {milestones.map((m) => (
          <li key={m.id} className="flex items-center gap-2 text-sm">
            {canEdit ? (
              <Checkbox
                checked={m.status === "done"}
                aria-label={`Mark ${m.name} ${m.status === "done" ? "open" : "done"}`}
                onCheckedChange={(v) => start(async () => {
                  const r = await setMilestoneDoneAction(m.id, v === true);
                  if (!r.ok) toast.error(r.error);
                  router.refresh();
                })}
              />
            ) : (
              <DiamondIcon className={cn("size-3.5", m.status === "done" ? "fill-success text-success" : "text-muted-foreground")} />
            )}
            <span className={cn("flex-1", m.status === "done" && "text-muted-foreground line-through")}>{m.name}</span>
            {m.due_date && (
              <span className={cn("num text-xs", m.status !== "done" && m.due_date < today ? "text-danger" : "text-muted-foreground")}>{fmtDate(m.due_date, "d MMM")}</span>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addMilestoneAction({ project_id: projectId, name, due_date: due });
              if (!r.ok) return void toast.error(r.error);
              setName("");
              setDue("");
              router.refresh();
            });
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a milestone" aria-label="Milestone name" className="h-8 flex-1" maxLength={200} />
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Milestone due date" className="num h-8 w-36" />
          <Button type="submit" size="sm" variant="secondary" disabled={pending || name.trim().length < 2}>
            Add
          </Button>
        </form>
      )}
    </div>
  );
}

export function ProjectFormDialog({ open, onOpenChange, people, deals }: { open: boolean; onOpenChange: (o: boolean) => void; people: Opt[]; deals: Opt[] }) {
  const router = useRouter();
  const [v, setV] = useState({ name: "", description: "", deal_id: "", owner_id: "", status: "active", start_date: "", target_date: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>New project</DialogTitle>
        <form
          noValidate
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createProjectAction(v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success("Project created");
              onOpenChange(false);
              router.push(`/tasks/projects/${r.data.id}`);
            });
          }}
        >
          <FormField label="Name" htmlFor="pj-name" error={errors.name} className="sm:col-span-2">
            <Input id="pj-name" value={v.name} onChange={(e) => set("name", e.target.value)} autoFocus maxLength={200} />
          </FormField>
          <FormField label="Owner" htmlFor="pj-owner">
            <NativeSelect id="pj-owner" value={v.owner_id} onChange={(e) => set("owner_id", e.target.value)}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Deal" htmlFor="pj-deal">
            <NativeSelect id="pj-deal" value={v.deal_id} onChange={(e) => set("deal_id", e.target.value)}>
              <option value="">None</option>
              {deals.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Start" htmlFor="pj-start" error={errors.start_date}>
            <Input id="pj-start" type="date" value={v.start_date} onChange={(e) => set("start_date", e.target.value)} className="num" />
          </FormField>
          <FormField label="Target" htmlFor="pj-target" error={errors.target_date}>
            <Input id="pj-target" type="date" value={v.target_date} onChange={(e) => set("target_date", e.target.value)} className="num" />
          </FormField>
          <FormField label="Description" htmlFor="pj-desc" className="sm:col-span-2">
            <Textarea id="pj-desc" value={v.description} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={4000} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} Create project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
