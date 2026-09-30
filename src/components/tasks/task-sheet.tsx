"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArchiveIcon, CornerDownRightIcon, LinkIcon, PencilIcon, RepeatIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate, relativeTime, todayDubai } from "@/lib/dates";
import { TASK_STATUSES, RECURRENCES } from "@/lib/schemas/tasks";
import { cn } from "@/lib/utils";
import {
  addChecklistItemAction,
  addCommentAction,
  addDependencyAction,
  getTaskDetailAction,
  removeChecklistItemAction,
  removeDependencyAction,
  setTaskArchivedAction,
  setTaskStatusAction,
  toggleChecklistItemAction,
} from "@/server/actions/tasks";
import type { TaskRow } from "@/server/tasks";
import { PRIORITY_LABEL, PRIORITY_TONE, STATUS_LABEL } from "./labels";
import { TaskFormDialog, loadTaskOptions } from "./task-form-dialog";

type Detail = NonNullable<Awaited<ReturnType<typeof getTaskDetailAction>>>;

/** Opens for ?task=<id> or ?record=task:<id>, from any page. */
export function TaskSheet() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rec = sp.get("record");
  const id = sp.get("task") ?? (rec?.startsWith("task:") ? rec.slice(5) : null);
  const [loaded, setLoaded] = useState<{ id: string; detail: Detail | "missing" } | null>(null);
  const [editing, setEditing] = useState(false);
  const [openTasks, setOpenTasks] = useState<{ value: string; label: string }[]>([]);
  const [pending, start] = useTransition();
  const detail = loaded && loaded.id === id ? loaded.detail : null;

  const reload = useCallback(async () => {
    if (!id) return;
    const d = await getTaskDetailAction(id);
    setLoaded({ id, detail: d ?? "missing" });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getTaskDetailAction(id).then((d) => !cancelled && setLoaded({ id, detail: d ?? "missing" }));
    loadTaskOptions(true).then((o) => !cancelled && setOpenTasks(o.openTasks));
    return () => {
      cancelled = true;
    };
  }, [id]);

  function close() {
    const p = new URLSearchParams(sp.toString());
    p.delete("task");
    if (p.get("record")?.startsWith("task:")) p.delete("record");
    router.push(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      if (success) toast.success(success);
      await reload();
      router.refresh();
    });
  }

  const t = detail && detail !== "missing" ? detail.task : null;
  const today = todayDubai();

  return (
    <>
      <Sheet open={Boolean(id)} onOpenChange={(o) => !o && close()}>
        <SheetContent className="sm:max-w-lg">
          {detail === null && (
            <div className="space-y-3 p-6">
              <SheetTitle className="sr-only">Loading task</SheetTitle>
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
          {detail === "missing" && (
            <div className="p-6">
              <SheetTitle>Not available</SheetTitle>
              <SheetDescription className="mt-2">This task doesn&apos;t exist or you don&apos;t have access to it.</SheetDescription>
            </div>
          )}
          {t && detail && detail !== "missing" && (
            <div className="flex-1 overflow-y-auto" aria-busy={pending}>
              <div className="border-b p-6 pr-12">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Task</p>
                <SheetTitle className={cn("mt-1 text-xl", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</SheetTitle>
                <SheetDescription className="sr-only">Task details</SheetDescription>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge variant={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                  {t.due_date && (
                    <Badge variant={t.due_date < today && t.status !== "done" ? "danger" : "outline"}>Due {fmtDate(t.due_date)}</Badge>
                  )}
                  {t.recurrence_rule && (
                    <Badge variant="info">
                      <RepeatIcon className="size-3" /> {RECURRENCES.find((r) => r.value === t.recurrence_rule)?.label ?? "Repeats"}
                    </Badge>
                  )}
                  {t.is_demo && <Badge variant="warning">Demo</Badge>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <NativeSelect
                    aria-label="Status"
                    className="w-40"
                    value={t.status}
                    onChange={(e) => run(() => setTaskStatusAction(t.id, e.target.value as TaskRow["status"]), "Status updated")}
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <PencilIcon /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => run(async () => { const r = await setTaskArchivedAction(t.id, true); if (r.ok) close(); return r; }, "Task archived")}>
                    <ArchiveIcon /> Archive
                  </Button>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 p-6 text-sm">
                <Field label="Assignee">{t.assignee_name ?? "Unassigned"}</Field>
                <Field label="Project">{t.project_name ?? "—"}</Field>
                <Field label="Deal">{t.deal_id ? <Link className="text-gold-ink hover:underline" href={`/deals/${t.deal_id}`}>{t.deal_name}</Link> : "—"}</Field>
                <Field label="Organization">{t.organization_id ? <Link className="text-gold-ink hover:underline" href={`/partners/${t.organization_id}`}>{t.organization_name}</Link> : "—"}</Field>
              </dl>
              {t.description && <p className="border-t px-6 py-4 text-sm leading-relaxed whitespace-pre-wrap">{t.description}</p>}

              <Section title={`Checklist${detail.checklist.length ? ` · ${detail.checklist.filter((c) => c.done).length}/${detail.checklist.length}` : ""}`}>
                <ul className="space-y-1.5">
                  {detail.checklist.map((c) => (
                    <li key={c.id} className="group flex items-center gap-2 text-sm">
                      <Checkbox checked={c.done} onCheckedChange={(v) => run(() => toggleChecklistItemAction(c.id, v === true))} aria-label={c.label} />
                      <span className={cn("flex-1", c.done && "text-muted-foreground line-through")}>{c.label}</span>
                      <button aria-label={`Remove ${c.label}`} className="cursor-pointer text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger" onClick={() => run(() => removeChecklistItemAction(c.id))}>
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                <InlineAdd placeholder="Add an item" onAdd={(v) => run(() => addChecklistItemAction(t.id, v))} />
              </Section>

              <Section title="Dependencies">
                {detail.blockedBy.length === 0 && detail.blocking.length === 0 && <p className="text-sm text-muted-foreground">No dependencies.</p>}
                <ul className="space-y-1.5 text-sm">
                  {detail.blockedBy.map((b) => (
                    <li key={b.id} className="flex items-center gap-2">
                      <LinkIcon className="size-3.5 text-muted-foreground" />
                      <span className="flex-1">
                        Waits on <Link href={`?task=${b.id}`} className="hover:underline">{b.title}</Link>{" "}
                        <Badge variant={b.status === "done" ? "success" : "warning"}>{STATUS_LABEL[b.status]}</Badge>
                      </span>
                      <button aria-label={`Remove dependency on ${b.title}`} className="cursor-pointer text-muted-foreground hover:text-danger" onClick={() => run(() => removeDependencyAction(t.id, b.id))}>
                        <XIcon className="size-3.5" />
                      </button>
                    </li>
                  ))}
                  {detail.blocking.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 text-muted-foreground">
                      <CornerDownRightIcon className="size-3.5" />
                      Blocks <Link href={`?task=${b.id}`} className="text-foreground hover:underline">{b.title}</Link>
                    </li>
                  ))}
                </ul>
                <NativeSelect
                  aria-label="Add a task this one waits on"
                  className="mt-2"
                  value=""
                  onChange={(e) => e.target.value && run(() => addDependencyAction(t.id, e.target.value), "Dependency added")}
                >
                  <option value="">Waits on another task…</option>
                  {openTasks
                    .filter((o) => o.value !== t.id && !detail.blockedBy.some((b) => b.id === o.value))
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                </NativeSelect>
              </Section>

              <Section title="Comments">
                <ul className="space-y-3">
                  {detail.comments.map((c) => (
                    <li key={c.id} className="text-sm">
                      <p className="text-xs text-muted-foreground">
                        <span className="text-foreground">{c.author?.full_name ?? "Someone"}</span> · {relativeTime(c.created_at)}
                      </p>
                      <p className="mt-0.5 leading-relaxed whitespace-pre-wrap">{c.body}</p>
                    </li>
                  ))}
                </ul>
                <CommentBox onPost={(body) => run(() => addCommentAction(t.id, body))} />
              </Section>
            </div>
          )}
        </SheetContent>
      </Sheet>
      {t && (
        <TaskFormDialog
          key={t.id}
          open={editing}
          onOpenChange={setEditing}
          taskId={t.id}
          onSaved={() => (reload(), router.refresh())}
          initial={{
            title: t.title,
            description: t.description ?? "",
            status: t.status,
            priority: t.priority,
            due_date: t.due_date ?? "",
            assignee_id: t.assignee_id ?? "",
            project_id: t.project_id ?? "",
            milestone_id: t.milestone_id ?? "",
            deal_id: t.deal_id ?? "",
            organization_id: t.organization_id ?? "",
            recurrence_rule: t.recurrence_rule ?? "",
          }}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t px-6 py-4">
      <h3 className="num mb-2 text-xs text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function InlineAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="mt-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onAdd(v.trim());
        setV("");
      }}
    >
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-8" maxLength={300} />
    </form>
  );
}

function CommentBox({ onPost }: { onPost: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onPost(v.trim());
        setV("");
      }}
    >
      <Textarea value={v} onChange={(e) => setV(e.target.value)} placeholder="Write a comment…" rows={2} aria-label="Comment" maxLength={5000} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="secondary" disabled={!v.trim()}>
          Comment
        </Button>
      </div>
    </form>
  );
}
