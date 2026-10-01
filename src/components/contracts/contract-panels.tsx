"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArchiveIcon, ArchiveRestoreIcon, CheckIcon, Loader2Icon, MoreHorizontalIcon, PencilIcon, PlusIcon, RotateCcwIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FormField } from "@/components/form-field";
import { fmtDate } from "@/lib/dates";
import {
  addObligationAction,
  reviewContractAction,
  addSurvivalAction,
  removeSurvivalAction,
  setContractArchivedAction,
  setObligationStatusAction,
} from "@/server/actions/contracts";
import { ContractFormDialog, type ContractFormValues } from "./contract-form-dialog";

type Opt = { value: string; label: string };

export function ContractActions({
  id,
  archived,
  initial,
  options,
  reviewBlocked,
}: {
  id: string;
  archived: boolean;
  /** Why the AI clause review can't run, or null when it can. */
  reviewBlocked: string | null;
  initial: ContractFormValues;
  options: { orgs: Opt[]; people: Opt[]; documents: Opt[] };
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <ClauseReviewButton id={id} blocked={reviewBlocked} />
      {!archived && (
        <Button size="sm" onClick={() => setEdit(true)}>
          <PencilIcon /> Edit
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="More actions" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <MoreHorizontalIcon />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              start(async () => {
                const r = await setContractArchivedAction(id, !archived);
                if (!r.ok) return void toast.error(r.error);
                toast.success(archived ? "Restored" : "Archived. Alerts stop for this contract.");
                router.refresh();
              })
            }
          >
            {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />} {archived ? "Restore" : "Archive"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ContractFormDialog open={edit} onOpenChange={setEdit} contractId={id} initial={initial} options={options} />
    </>
  );
}

export type Obligation = {
  id: string;
  description: string;
  due_date: string | null;
  status: string;
  task_id: string | null;
  owner: { full_name: string } | null;
  task: { id: string; status: string } | null;
};

export function ObligationsPanel({ contractId, items, people, today, archived }: { contractId: string; items: Obligation[]; people: Opt[]; today: string; archived: boolean }) {
  const router = useRouter();
  const [v, setV] = useState({ description: "", due_date: "", owner_id: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();

  const setStatus = (id: string, status: "open" | "done" | "waived") =>
    start(async () => {
      const r = await setObligationStatusAction(contractId, id, status);
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No obligations recorded.</p>
      ) : (
        <ul className="divide-y">
          {items.map((o) => {
            const overdue = o.status === "open" && o.due_date && o.due_date < today;
            return (
              <li key={o.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className={o.status !== "open" ? "text-muted-foreground line-through" : undefined}>{o.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {o.due_date ? <span className={overdue ? "text-danger" : "num"}>Due {fmtDate(o.due_date)}</span> : "No due date"}
                    {" · "}
                    {o.owner?.full_name ?? "Contract owner"}
                    {o.task && (
                      <>
                        {" · "}
                        <Link href={`?task=${o.task.id}`} scroll={false} className="hover:text-gold-ink">
                          Task
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {o.status === "open" ? (
                    <>
                      <Badge variant={overdue ? "danger" : "outline"}>{overdue ? "Overdue" : "Open"}</Badge>
                      {!archived && (
                        <>
                          <Button variant="ghost" size="sm" aria-label={`Mark done: ${o.description}`} disabled={pending} onClick={() => setStatus(o.id, "done")}>
                            <CheckIcon />
                          </Button>
                          <Button variant="ghost" size="sm" aria-label={`Waive: ${o.description}`} disabled={pending} onClick={() => setStatus(o.id, "waived")}>
                            <XIcon />
                          </Button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <Badge variant={o.status === "done" ? "success" : "outline"}>{o.status === "done" ? "Done" : "Waived"}</Badge>
                      {!archived && (
                        <Button variant="ghost" size="sm" aria-label={`Reopen: ${o.description}`} disabled={pending} onClick={() => setStatus(o.id, "open")}>
                          <RotateCcwIcon />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!archived &&
        (adding ? (
          <form
            noValidate
            className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await addObligationAction({ contract_id: contractId, ...v });
                if (!r.ok) {
                  setErrors(r.fieldErrors ?? {});
                  return void toast.error(r.error);
                }
                toast.success(r.data.taskId ? "Obligation added and a task created for it" : "Obligation added");
                setV({ description: "", due_date: "", owner_id: "" });
                setErrors({});
                setAdding(false);
                router.refresh();
              });
            }}
          >
            <FormField label="Obligation" htmlFor="ob-desc" error={errors.description} className="sm:col-span-2">
              <Input id="ob-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={500} autoFocus />
            </FormField>
            <FormField label="Due date" htmlFor="ob-due" hint="With a date, it also becomes a task.">
              <Input id="ob-due" type="date" value={v.due_date} onChange={(e) => setV({ ...v, due_date: e.target.value })} />
            </FormField>
            <FormField label="Owner" htmlFor="ob-owner">
              <NativeSelect id="ob-owner" value={v.owner_id} onChange={(e) => setV({ ...v, owner_id: e.target.value })}>
                <option value="">Contract owner</option>
                {people.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                Add obligation
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <PlusIcon /> Add obligation
          </Button>
        ))}
    </div>
  );
}

export function SurvivalPanel({
  contractId,
  items,
  endDate,
  archived,
}: {
  contractId: string;
  items: { id: string; clause: string; survival_months: number; lapses: string | null }[];
  endDate: string | null;
  archived: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState({ clause: "", survival_months: "24" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No clauses survive termination.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p>{s.clause}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="num">{s.survival_months}</span> months after the term ends
                  {s.lapses ? (
                    <>
                      {" "}
                      · lapses <span className="num">{fmtDate(s.lapses)}</span>
                    </>
                  ) : (
                    " · set an end date to compute"
                  )}
                </p>
              </div>
              {!archived && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${s.clause}`}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await removeSurvivalAction(contractId, s.id);
                      if (!r.ok) return void toast.error(r.error);
                      router.refresh();
                    })
                  }
                >
                  <Trash2Icon />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!archived && (
        <form
          noValidate
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addSurvivalAction({ contract_id: contractId, ...v });
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              setV({ clause: "", survival_months: "24" });
              setErrors({});
              router.refresh();
            });
          }}
        >
          <FormField label="Surviving clause" htmlFor="sv-clause" error={errors.clause} className="min-w-40 flex-1">
            <Input id="sv-clause" value={v.clause} onChange={(e) => setV({ ...v, clause: e.target.value })} placeholder="e.g. Non-circumvention" maxLength={300} />
          </FormField>
          <FormField label="Months" htmlFor="sv-months" error={errors.survival_months} className="w-24">
            <Input id="sv-months" type="number" min={1} value={v.survival_months} onChange={(e) => setV({ ...v, survival_months: e.target.value })} />
          </FormField>
          <Button type="submit" variant="outline" size="sm" disabled={pending || !v.clause.trim()}>
            Add
          </Button>
        </form>
      )}
      {!endDate && items.length > 0 && <p className="text-xs text-warning">No end date on the contract, so survival periods can&apos;t be tracked yet.</p>}
    </div>
  );
}

function ClauseReviewButton({ id, blocked }: { id: string; blocked: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const button = (
    <Button
      variant="outline"
      size="sm"
      disabled={Boolean(blocked) || pending}
      onClick={() =>
        start(async () => {
          const r = await reviewContractAction(id);
          if (!r.ok) return void toast.error(r.error);
          toast.success(`Review saved: ${r.data.findings.length} finding${r.data.findings.length === 1 ? "" : "s"}.`);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />} {pending ? "Reviewing…" : "AI clause review"}
    </Button>
  );
  if (!blocked) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* span keeps the tooltip working on a disabled button */}
        <span tabIndex={0}>{button}</span>
      </TooltipTrigger>
      <TooltipContent>{blocked}</TooltipContent>
    </Tooltip>
  );
}
