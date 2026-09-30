import Link from "next/link";
import {
  AlarmClockIcon,
  BellRingIcon,
  CircleCheckBigIcon,
  FileSignatureIcon,
  HourglassIcon,
  ReceiptIcon,
  ScaleIcon,
  ShieldQuestionIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AttentionItem } from "@/server/command-center";

const KIND: Record<string, { icon: LucideIcon; label: string }> = {
  task_overdue: { icon: AlarmClockIcon, label: "Overdue task" },
  contract_expiring: { icon: HourglassIcon, label: "Contract ending" },
  notice_deadline: { icon: BellRingIcon, label: "Notice deadline" },
  contract_open_issues: { icon: ScaleIcon, label: "Contract issue" },
  survival_ending: { icon: HourglassIcon, label: "Survival period" },
  compliance_due: { icon: AlarmClockIcon, label: "Compliance" },
  compliance_unconfirmed: { icon: ShieldQuestionIcon, label: "To confirm" },
  document_unsigned: { icon: FileSignatureIcon, label: "Unsigned" },
  invoice_overdue: { icon: ReceiptIcon, label: "Invoice overdue" },
  deal_stale: { icon: HourglassIcon, label: "Stale deal" },
};

const SEVERITY = {
  high: { dot: "bg-danger", label: "High" },
  medium: { dot: "bg-warning", label: "Medium" },
  low: { dot: "bg-info", label: "Low" },
} as const;

export function AttentionQueue({ items, limit = 8 }: { items: AttentionItem[]; limit?: number }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <CircleCheckBigIcon className="size-5 text-success" />
        Nothing needs your attention right now.
      </div>
    );
  }
  const shown = items.slice(0, limit);
  return (
    <div>
      <ul className="-mx-1 divide-y divide-border">
        {shown.map((it) => {
          const k = KIND[it.kind] ?? { icon: AlarmClockIcon, label: it.kind };
          const sev = SEVERITY[it.severity];
          return (
            <li key={`${it.kind}:${it.entity_id}:${it.title}`} className="group flex items-start gap-3 px-1 py-2.5">
              <span className="mt-1.5 flex items-center" title={`${sev.label} priority`}>
                <span className={cn("size-2 rounded-full", sev.dot)} />
                <span className="sr-only">{sev.label} priority</span>
              </span>
              <Link
                href={`?record=${it.entity_type}:${it.entity_id}`}
                scroll={false}
                className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <k.icon className="size-3" /> {k.label}
                </span>
                <span className="mt-0.5 block truncate text-sm group-hover:text-gold-ink">{it.title}</span>
                <span className="num block truncate text-xs text-muted-foreground">{it.detail}</span>
              </Link>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Button variant="ghost" size="icon-sm" disabled aria-label="Ask agent to handle (Phase 4)">
                      <SparklesIcon />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">Ask agent to handle · arrives in Phase 4</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      {items.length > limit && (
        <p className="num mt-2 text-xs text-muted-foreground">
          +{items.length - limit} more. The full queue gets its own view with the agent in Phase 4.
        </p>
      )}
    </div>
  );
}
