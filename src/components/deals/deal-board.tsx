"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CalendarIcon, EllipsisIcon, GripVerticalIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCompact } from "@/lib/money";
import { fmtDate, todayDubai } from "@/lib/dates";
import { moveDealStageAction } from "@/server/actions/deals";
import type { DealRow } from "@/server/deals";
import { MoveStageDialog, type PendingMove } from "./move-stage-dialog";

type Stage = { key: string; label: string; is_terminal: boolean; is_won: boolean };

export function DealBoard({ deals, stages }: { deals: DealRow[]; stages: Stage[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [optimistic, applyMove] = useOptimistic(deals, (state, m: { id: string; stage: string }) =>
    state.map((d) => (d.id === m.id ? { ...d, stage: m.stage } : d)),
  );
  const [pendingMove, setPendingMove] = useState<PendingMove>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function requestMove(deal: DealRow, stageKey: string) {
    if (deal.stage === stageKey) return;
    const st = stages.find((s) => s.key === stageKey)!;
    if (st.is_terminal) {
      setPendingMove({ dealId: deal.id, dealName: deal.name, stage: st.key, stageLabel: st.label, terminal: true });
      return;
    }
    const from = stages.find((s) => s.key === deal.stage)!;
    start(async () => {
      applyMove({ id: deal.id, stage: stageKey });
      const r = await moveDealStageAction({ dealId: deal.id, stage: stageKey });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`${deal.name} → ${st.label}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const u = await moveDealStageAction({ dealId: deal.id, stage: from.key, note: "Undo" });
            if (!u.ok) toast.error(u.error);
            router.refresh();
          },
        },
      });
      router.refresh();
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const deal = optimistic.find((d) => d.id === e.active.id);
    if (deal && e.over) requestMove(deal, String(e.over.id));
  }

  const today = todayDubai();

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" role="region" aria-label="Deal board">
          <div className="flex gap-3">
            {stages.map((s) => {
              const col = optimistic.filter((d) => d.stage === s.key);
              const total = col.reduce((a, d) => a + (d.value_usd ?? 0), 0);
              return (
                <Column key={s.key} stage={s} count={col.length} total={total}>
                  {col.map((d) => (
                    <DealCard key={d.id} deal={d} stages={stages} today={today} onMove={(k) => requestMove(d, k)} />
                  ))}
                </Column>
              );
            })}
          </div>
        </div>
      </DndContext>
      <MoveStageDialog move={pendingMove} onClose={() => setPendingMove(null)} />
    </>
  );
}

function Column({ stage, count, total, children }: { stage: Stage; count: number; total: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.label}, ${count} deals`}
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-lg border bg-surface-2/40 transition-colors",
        stage.is_terminal && "w-52 opacity-90",
        isOver && "border-gold/60 bg-gold-wash/40",
      )}
    >
      <header className="flex items-baseline justify-between gap-2 px-3 pt-3 pb-2">
        <h3 className="truncate text-xs font-medium">{stage.label}</h3>
        <span className="num shrink-0 text-[11px] text-muted-foreground">
          {count}
          {total > 0 && ` · ${formatCompact(total, "USD")}`}
        </span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">{children}</div>
    </section>
  );
}

function DealCard({ deal, stages, today, onMove }: { deal: DealRow; stages: Stage[]; today: string; onMove: (stage: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const overdue = deal.next_step_due && deal.next_step_due < today;
  return (
    <article
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn("group rounded-md border bg-surface p-2.5 text-sm shadow-black/20", isDragging && "z-20 shadow-lg ring-1 ring-gold/50")}
    >
      <div className="flex items-start gap-1.5">
        <button
          {...listeners}
          {...attributes}
          aria-label={`Drag ${deal.name}`}
          className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-3.5" />
        </button>
        <Link href={`/deals/${deal.id}`} className="min-w-0 flex-1 leading-snug hover:text-gold-ink">
          {deal.name}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="-mt-1 -mr-1 size-6" aria-label={`Move ${deal.name}`}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to…</DropdownMenuLabel>
            {stages
              .filter((s) => s.key !== deal.stage)
              .map((s) => (
                <DropdownMenuItem key={s.key} onSelect={() => onMove(s.key)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="num mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="text-foreground">{deal.value_usd != null ? formatCompact(deal.value_usd, "USD") : "No ticket"}</span>
        <span>· {deal.probability}%</span>
        {deal.country_name && <span>· {deal.country_name}</span>}
        {deal.is_demo && <Badge variant="outline">Demo</Badge>}
      </div>
      {deal.next_step && (
        <p className={cn("mt-1.5 flex items-start gap-1 text-[11px] text-muted-foreground", overdue && "text-danger")}>
          <CalendarIcon className="mt-0.5 size-3 shrink-0" />
          <span className="line-clamp-2">
            {deal.next_step}
            {deal.next_step_due && ` · ${fmtDate(deal.next_step_due, "d MMM")}`}
          </span>
        </p>
      )}
    </article>
  );
}
