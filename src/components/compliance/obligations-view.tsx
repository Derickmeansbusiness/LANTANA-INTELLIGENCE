"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, CircleDashedIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, RepeatIcon, ShieldQuestionIcon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { daysBetween, fmtDate, todayDubai } from "@/lib/dates";
import { COMPLIANCE_CATEGORIES, RECURRENCES } from "@/lib/schemas/compliance";
import { label } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";
import type { ObligationRow } from "@/server/compliance";
import { saveObligationAction, setObligationStatusAction } from "@/server/actions/compliance";

type Opt = { value: string; label: string };

export function ObligationsView({ rows, principal, people, documents }: { rows: ObligationRow[]; principal: boolean; people: Opt[]; documents: Opt[] }) {
  const [editing, setEditing] = useState<ObligationRow | "new" | null>(null);
  const [confirming, setConfirming] = useState<ObligationRow | null>(null);
  const today = todayDubai();
  const unconfirmed = rows.filter((r) => r.status === "unconfirmed");
  const live = rows.filter((r) => ["upcoming", "in_progress"].includes(r.status));
  const overdue = live.filter((r) => r.due_date && r.due_date < today);
  const ahead = live.filter((r) => !r.due_date || r.due_date >= today);
  const done = rows.filter((r) => r.status === "done").sort((a, b) => (b.completed_on ?? "").localeCompare(a.completed_on ?? "")).slice(0, 10);
  const na = rows.filter((r) => r.status === "not_applicable");

  // Group the year ahead by month so the calendar reads at a glance.
  const byMonth = new Map<string, ObligationRow[]>();
  for (const r of ahead) {
    const k = r.due_date ? r.due_date.slice(0, 7) : "undated";
    byMonth.set(k, [...(byMonth.get(k) ?? []), r]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Only obligations a principal has confirmed drive alerts. Anything else waits below as “confirm whether this applies”.
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <PlusIcon /> New obligation
        </Button>
      </div>

      {unconfirmed.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldQuestionIcon className="size-4 text-warning" /> Confirm whether these apply
              </CardTitle>
              <CardDescription>{principal ? "Confirm with the real date, or mark not applicable." : "A principal confirms these. Until then they drive no alerts."}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {unconfirmed.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {r.title}
                      {r.is_demo && <Badge variant="outline" className="ml-2 align-middle">Demo</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">{[label(r.category), r.authority].filter(Boolean).join(" · ")}</p>
                    {r.notes && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{r.notes}</p>}
                  </div>
                  {principal ? (
                    <div className="flex gap-2">
                      <NotApplicable id={r.id} />
                      <Button size="sm" onClick={() => setConfirming(r)}>
                        <CheckCircle2Icon /> Confirm
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="warning">Waiting for a principal</Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {overdue.length > 0 && (
        <Card className="border-danger/40">
          <CardHeader>
            <CardTitle className="text-danger">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {overdue.map((r) => (
                <Item key={r.id} r={r} today={today} onEdit={() => setEditing(r)} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Calendar</CardTitle>
            <CardDescription>Confirmed obligations by month. Completing a recurring one schedules the next.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {byMonth.size === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing confirmed ahead.</p>
          ) : (
            <div className="space-y-5">
              {[...byMonth.entries()].map(([month, items]) => (
                <section key={month} aria-label={month === "undated" ? "No date" : fmtDate(`${month}-01`, "MMMM yyyy")}>
                  <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{month === "undated" ? "No date" : fmtDate(`${month}-01`, "MMMM yyyy")}</h3>
                  <ul className="divide-y">
                    {items.map((r) => (
                      <Item key={r.id} r={r} today={today} onEdit={() => setEditing(r)} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(done.length > 0 || na.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {done.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Done recently</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {done.map((r) => (
                    <li key={r.id} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{r.title}</span>
                      <span className="num shrink-0 text-muted-foreground">{r.completed_on ? fmtDate(r.completed_on) : ""}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {na.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Not applicable</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {na.map((r) => (
                    <li key={r.id}>
                      {r.title}
                      {r.confirmed_by && <span className="text-xs"> · decided by {r.confirmed_by}</span>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {editing && (
        <ObligationDialog
          row={editing === "new" ? null : editing}
          principal={principal}
          people={people}
          documents={documents}
          onClose={() => setEditing(null)}
        />
      )}
      {confirming && <ObligationDialog row={confirming} confirm principal people={people} documents={documents} onClose={() => setConfirming(null)} />}
    </div>
  );
}

function Item({ r, today, onEdit }: { r: ObligationRow; today: string; onEdit: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const days = r.due_date ? daysBetween(today, r.due_date) : null;
  const set = (status: string, msg: string) =>
    start(async () => {
      const res = await setObligationStatusAction(r.id, status);
      if (!res.ok) return void toast.error(res.error);
      toast.success(msg);
      router.refresh();
    });
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {r.title}
          {r.is_demo && <Badge variant="outline" className="ml-2 align-middle">Demo</Badge>}
        </p>
        <p className="text-xs text-muted-foreground">
          {r.due_date && (
            <span className={cn("num", days != null && days < 0 && "text-danger", days != null && days >= 0 && days <= 30 && "text-warning")}>
              {fmtDate(r.due_date)} · {days! < 0 ? `${-days!} d overdue` : `${days} d`}
            </span>
          )}
          {r.recurrence && (
            <span className="ml-1 inline-flex items-center gap-0.5">
              · <RepeatIcon className="size-3" /> {r.recurrence}
            </span>
          )}
          {[r.authority, r.owner].filter(Boolean).map((x) => ` · ${x}`)}
          {r.document_id && (
            <>
              {" · "}
              <Link href={`/documents/${r.document_id}`} className="hover:text-gold-ink">
                document
              </Link>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {r.status === "in_progress" && <Badge variant="info">In progress</Badge>}
        <Button variant="outline" size="sm" disabled={pending} onClick={() => set("done", r.recurrence ? "Done. The next one is scheduled." : "Done")}>
          <CheckCircle2Icon /> Done
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`More for ${r.title}`} disabled={pending}>
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {r.status !== "in_progress" && (
              <DropdownMenuItem onSelect={() => set("in_progress", "Marked in progress")}>
                <CircleDashedIcon /> In progress
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onEdit}>
              <PencilIcon /> Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function NotApplicable({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await setObligationStatusAction(id, "not_applicable");
          if (!r.ok) return void toast.error(r.error);
          toast.success("Marked not applicable");
          router.refresh();
        })
      }
    >
      <XCircleIcon /> Doesn’t apply
    </Button>
  );
}

function ObligationDialog({
  row,
  confirm,
  principal,
  people,
  documents,
  onClose,
}: {
  row: ObligationRow | null;
  confirm?: boolean;
  principal: boolean;
  people: Opt[];
  documents: Opt[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState({
    title: row?.title ?? "",
    category: row?.category ?? "filing",
    authority: row?.authority ?? "",
    due_date: row?.due_date ?? "",
    recurrence: row?.recurrence ?? "",
    status: confirm ? "upcoming" : (row?.status ?? (principal ? "upcoming" : "unconfirmed")),
    owner_id: row?.owner_id ?? "",
    document_id: row?.document_id ?? "",
    notes: row?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const statuses = principal ? ["unconfirmed", "upcoming", "in_progress", "done", "not_applicable"] : row && row.status !== "unconfirmed" ? ["upcoming", "in_progress", "done"] : ["unconfirmed"];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle>{confirm ? "Confirm this obligation" : row ? "Edit obligation" : "New obligation"}</DialogTitle>
        <DialogDescription className="mt-1">
          {confirm
            ? "Confirming records you as the person who decided it applies. Alerts go out at 90, 60, 30 and 7 days."
            : principal
              ? "Add it confirmed with a date, or as unconfirmed if you're not sure yet."
              : "It's added as unconfirmed. A principal confirms whether it applies."}
        </DialogDescription>
        <form
          noValidate
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveObligationAction(row?.id ?? null, v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success(confirm ? "Confirmed" : "Saved");
              onClose();
              router.refresh();
            });
          }}
        >
          <FormField label="Obligation" htmlFor="ob-title" error={errors.title} className="sm:col-span-2">
            <Input id="ob-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </FormField>
          <FormField label="Category" htmlFor="ob-cat">
            <NativeSelect id="ob-cat" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
              {COMPLIANCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Authority" htmlFor="ob-auth">
            <Input id="ob-auth" value={v.authority} onChange={(e) => setV({ ...v, authority: e.target.value })} placeholder="e.g. RAKEZ, FTA" />
          </FormField>
          <FormField label="Due date" htmlFor="ob-due" error={errors.due_date}>
            <Input id="ob-due" type="date" value={v.due_date} onChange={(e) => setV({ ...v, due_date: e.target.value })} />
          </FormField>
          <FormField label="Repeats" htmlFor="ob-rec" error={errors.recurrence}>
            <NativeSelect id="ob-rec" value={v.recurrence} onChange={(e) => setV({ ...v, recurrence: e.target.value })}>
              <option value="">Once</option>
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {label(r)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {!confirm && (
            <FormField label="Status" htmlFor="ob-status">
              <NativeSelect id="ob-status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })} disabled={statuses.length === 1}>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="Owner" htmlFor="ob-owner">
            <NativeSelect id="ob-owner" value={v.owner_id} onChange={(e) => setV({ ...v, owner_id: e.target.value })}>
              <option value="">Nobody yet</option>
              {people.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Supporting document" htmlFor="ob-doc" className="sm:col-span-2">
            <NativeSelect id="ob-doc" value={v.document_id} onChange={(e) => setV({ ...v, document_id: e.target.value })}>
              <option value="">None</option>
              {documents.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Notes" htmlFor="ob-notes" className="sm:col-span-2">
            <Textarea id="ob-notes" rows={3} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {confirm ? "Confirm" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
