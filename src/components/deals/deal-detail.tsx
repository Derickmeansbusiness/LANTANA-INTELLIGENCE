"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArchiveIcon, ArchiveRestoreIcon, ArrowRightLeftIcon, BookOpenCheckIcon, MessageSquarePlusIcon, PencilIcon, PlusIcon, UserMinusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fmtDate, todayDubai } from "@/lib/dates";
import { label } from "@/lib/schemas/common";
import {
  addDealMemberAction,
  addDealPartyAction,
  removeDealMemberAction,
  removeDealPartyAction,
  setDealArchivedAction,
} from "@/server/actions/deals";
import { DealFormDialog, type DealFormOptions, type DealFormValues } from "./deal-form-dialog";
import { MoveStageDialog, type PendingMove } from "./move-stage-dialog";
import { IntroductionDialog } from "@/components/ledger/introduction-dialog";
import { InteractionDialog } from "@/components/shared/interaction-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { PRIORITY_TONE, STATUS_LABEL } from "@/components/tasks/labels";

type Opt = { value: string; label: string };
type Stage = DealFormOptions["stages"][number];

export function DealActions({
  deal,
  stage,
  archived,
  canArchive,
  options,
  initial,
  introOptions,
}: {
  deal: { id: string; name: string };
  stage: string;
  archived: boolean;
  canArchive: boolean;
  options: DealFormOptions;
  initial: DealFormValues;
  introOptions: { orgs: Opt[]; contacts: (Opt & { orgId: string | null })[]; deals: Opt[] };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [move, setMove] = useState<PendingMove>(null);
  const [intro, setIntro] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIntro(true)}>
        <BookOpenCheckIcon /> Log introduction
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={archived}>
            <ArrowRightLeftIcon /> Move stage
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Move to…</DropdownMenuLabel>
          {options.stages
            .filter((s) => s.key !== stage)
            .map((s: Stage) => (
              <DropdownMenuItem key={s.key} onSelect={() => setMove({ dealId: deal.id, dealName: deal.name, stage: s.key, stageLabel: s.label, terminal: s.is_terminal })}>
                {s.label}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={archived}>
        <PencilIcon /> Edit
      </Button>
      {canArchive && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setDealArchivedAction(deal.id, !archived);
              if (!r.ok) return void toast.error(r.error);
              toast.success(archived ? "Deal restored" : "Deal archived. Restore it from this page any time.");
              router.refresh();
            })
          }
        >
          {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />} {archived ? "Restore" : "Archive"}
        </Button>
      )}
      <DealFormDialog open={editing} onOpenChange={setEditing} options={options} dealId={deal.id} initial={initial} />
      <MoveStageDialog move={move} onClose={() => setMove(null)} />
      <IntroductionDialog open={intro} onOpenChange={setIntro} dealId={deal.id} {...introOptions} />
    </>
  );
}

export function StageStepper({ stages, current }: { stages: Stage[]; current: string }) {
  const open = stages.filter((s) => !s.is_terminal);
  const idx = open.findIndex((s) => s.key === current);
  const terminal = stages.find((s) => s.key === current && s.is_terminal);
  return (
    <ol className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Deal stage">
      {open.map((s, i) => (
        <li
          key={s.key}
          aria-current={s.key === current ? "step" : undefined}
          className={cn(
            "flex h-7 min-w-24 flex-1 items-center justify-center rounded-sm border px-2 text-[11px] whitespace-nowrap",
            i < idx && "border-gold-soft/40 bg-gold-wash/40 text-muted-foreground",
            s.key === current && "border-gold bg-gold-wash font-medium text-gold-ink",
            (i > idx || terminal) && s.key !== current && "text-muted-foreground",
          )}
        >
          {s.label}
        </li>
      ))}
      {terminal && (
        <li aria-current="step" className="flex h-7 min-w-24 items-center justify-center rounded-sm border border-foreground/30 px-3 text-[11px] font-medium">
          {terminal.label}
        </li>
      )}
    </ol>
  );
}

const PARTY_ROLES = ["investor_introduced", "investor_interested", "buyer", "supplier", "co_advisor", "lender", "other"] as const;

export function PartiesPanel({
  dealId,
  parties,
  orgs,
  canManage,
}: {
  dealId: string;
  parties: { id: string; role: string; org: { id: string; name: string; type: string } | null }[];
  orgs: Opt[];
  canManage: boolean;
}) {
  const [org, setOrg] = useState("");
  const [role, setRole] = useState<(typeof PARTY_ROLES)[number]>("investor_interested");
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-3">
      {parties.length === 0 ? (
        <p className="text-sm text-muted-foreground">No investors, buyers or suppliers linked yet.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {parties.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <Link href={`/partners/${p.org?.id}`} className="min-w-0 flex-1 truncate hover:text-gold-ink">
                {p.org?.name}
              </Link>
              <Badge variant="outline">{label(p.role)}</Badge>
              {canManage && (
                <button
                  aria-label={`Remove ${p.org?.name}`}
                  className="cursor-pointer text-muted-foreground hover:text-danger"
                  onClick={() =>
                    start(async () => {
                      const r = await removeDealPartyAction(dealId, p.id);
                      if (!r.ok) toast.error(r.error);
                      router.refresh();
                    })
                  }
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addDealPartyAction({ dealId, organizationId: org, role });
            if (!r.ok) return void toast.error(r.error);
            setOrg("");
            router.refresh();
          });
        }}
      >
        <NativeSelect aria-label="Organization" value={org} onChange={(e) => setOrg(e.target.value)} className="min-w-0 flex-1 basis-40">
          <option value="">Link an organization…</option>
          {orgs
            .filter((o) => !parties.some((p) => p.org?.id === o.value))
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </NativeSelect>
        <NativeSelect aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="w-auto">
          {PARTY_ROLES.map((r) => (
            <option key={r} value={r}>
              {label(r)}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" size="sm" variant="secondary" disabled={!org || pending}>
          Add
        </Button>
      </form>
    </div>
  );
}

export function TeamPanel({
  dealId,
  ownerName,
  members,
  people,
  canManage,
}: {
  dealId: string;
  ownerName: string | null;
  members: { role: string; user: { id: string; full_name: string } | null }[];
  people: Opt[];
  canManage: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2 text-sm">
      <p>
        <span className="text-muted-foreground">Owner</span> · {ownerName ?? "Unassigned"}
      </p>
      <ul className="space-y-1.5">
        {members.map((m) => (
          <li key={m.user?.id} className="flex items-center gap-2">
            <span className="flex-1">{m.user?.full_name}</span>
            <Badge variant="outline">{label(m.role)}</Badge>
            {canManage && (
              <button
                aria-label={`Remove ${m.user?.full_name} from the deal`}
                className="cursor-pointer text-muted-foreground hover:text-danger"
                onClick={() => start(async () => {
                  const r = await removeDealMemberAction(dealId, m.user!.id);
                  if (!r.ok) toast.error(r.error);
                  router.refresh();
                })}
              >
                <UserMinusIcon className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <NativeSelect
          aria-label="Add a team member"
          value=""
          disabled={pending}
          onChange={(e) =>
            e.target.value &&
            start(async () => {
              const r = await addDealMemberAction(dealId, e.target.value);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Added to the deal. They can now see it.");
              router.refresh();
            })
          }
        >
          <option value="">Give someone access…</option>
          {people
            .filter((p) => !members.some((m) => m.user?.id === p.value))
            .map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
        </NativeSelect>
      )}
    </div>
  );
}

export function MatcherPanel({
  dealId,
  matches,
}: {
  dealId: string;
  matches: { organization_id: string; name: string; country: string | null; score: number; sector_points: number; geo_points: number; ticket_points: number; reasons: string[]; already_involved: boolean }[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (matches.length === 0) return <p className="text-sm text-muted-foreground">No investors on file yet. Add them under Partners.</p>;
  return (
    <ol className="space-y-3">
      {matches.map((m) => (
        <li key={m.organization_id} className="text-sm">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="num inline-flex w-10 shrink-0 justify-center rounded-sm border border-gold/40 bg-gold-wash py-0.5 text-xs text-gold-ink">
                  {m.score}
                </span>
              </TooltipTrigger>
              <TooltipContent className="num">
                Sector {m.sector_points}/40 · Geography {m.geo_points}/30 · Ticket {m.ticket_points}/30
              </TooltipContent>
            </Tooltip>
            <Link href={`/partners/${m.organization_id}`} className="min-w-0 flex-1 truncate hover:text-gold-ink">
              {m.name}
            </Link>
            {m.already_involved ? (
              <Badge variant="success">On the deal</Badge>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await addDealPartyAction({ dealId, organizationId: m.organization_id, role: "investor_interested" });
                    if (!r.ok) return void toast.error(r.error);
                    toast.success(`${m.name} linked as interested`);
                    router.refresh();
                  })
                }
              >
                <PlusIcon /> Link
              </Button>
            )}
          </div>
          <p className="mt-1 pl-12 text-xs text-muted-foreground">{m.reasons.join(" · ")}</p>
        </li>
      ))}
    </ol>
  );
}

export function DealTasks({
  dealId,
  tasks,
}: {
  dealId: string;
  tasks: { id: string; title: string; status: keyof typeof STATUS_LABEL; priority: keyof typeof PRIORITY_TONE; due_date: string | null; assignee: { full_name: string } | null }[];
}) {
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const today = todayDubai();
  return (
    <div className="space-y-2">
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks on this deal.</p>
      ) : (
        <ul className="divide-y">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
              <Link href={`?task=${t.id}`} scroll={false} className={cn("min-w-0 flex-1 truncate hover:text-gold-ink", t.status === "done" && "text-muted-foreground line-through")}>
                {t.title}
              </Link>
              <span className="hidden text-xs text-muted-foreground sm:inline">{t.assignee?.full_name ?? "Unassigned"}</span>
              {t.due_date && (
                <span className={cn("num text-xs", t.due_date < today && t.status !== "done" ? "text-danger" : "text-muted-foreground")}>{fmtDate(t.due_date, "d MMM")}</span>
              )}
              <Badge variant={t.status === "done" ? "success" : "outline"}>{STATUS_LABEL[t.status]}</Badge>
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
        <PlusIcon /> Add task
      </Button>
      <TaskFormDialog open={adding} onOpenChange={setAdding} initial={{ deal_id: dealId }} onSaved={() => router.refresh()} />
    </div>
  );
}

export function DealIntroductions({
  dealId,
  intros,
  introOptions,
}: {
  dealId: string;
  intros: { id: string; seq: number; introduced_on: string; channel: string; summary: string; corrects_id: string | null; a: { name: string } | null; b: { name: string } | null }[];
  introOptions: { orgs: Opt[]; contacts: (Opt & { orgId: string | null })[]; deals: Opt[] };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      {intros.length === 0 ? (
        <p className="text-sm text-muted-foreground">No introductions logged for this deal. Log one every time Lantana puts two parties in touch.</p>
      ) : (
        <ol className="space-y-3">
          {intros.map((i) => (
            <li key={i.id} className="text-sm">
              <p className="num text-xs text-muted-foreground">
                #{i.seq} · {fmtDate(i.introduced_on)} · {label(i.channel)}
                {i.corrects_id && <Badge variant="warning" className="ml-1.5">Correction</Badge>}
              </p>
              <p className="mt-0.5">
                {i.a?.name} ↔ {i.b?.name}
              </p>
              <p className="text-muted-foreground">{i.summary}</p>
            </li>
          ))}
        </ol>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <PlusIcon /> Log introduction
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/deals/ledger?deal=${dealId}`}>Full ledger</Link>
        </Button>
      </div>
      <IntroductionDialog open={open} onOpenChange={setOpen} dealId={dealId} {...introOptions} />
    </div>
  );
}

export function LogInteractionButton({ dealId, contacts }: { dealId: string; contacts: (Opt & { orgId: string | null })[]; }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <MessageSquarePlusIcon /> Log interaction
      </Button>
      <InteractionDialog open={open} onOpenChange={setOpen} dealId={dealId} contacts={contacts} />
    </>
  );
}

