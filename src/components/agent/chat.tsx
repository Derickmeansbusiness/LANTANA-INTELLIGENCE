"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, ArrowUpIcon, CheckIcon, CircleIcon, CopyIcon, Loader2Icon, MailIcon, SquareIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/dates";
import { confirmAgentAction, rejectAgentAction } from "@/server/actions/agent";
import type { ChatItem, Part, ProposalView } from "@/server/agent/view-types";
import { Markdown } from "./markdown";

export const EXAMPLES = [
  "How is the pipeline looking?",
  "What needs my attention today?",
  "When is the last day to give notice on the Faminas mandate?",
  "Which investors fit the Morogoro deal?",
];

const label = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// jsonb doesn't keep key order, so show preview fields in a sensible one.
const ORDER = ["template", "task", "title", "deal", "organization", "contract", "on", "kind", "before", "after", "obligation", "due", "priority", "assignee", "owner", "format", "note", "summary", "reason", "creates_task", "fields"];
const rank = (k: string) => (ORDER.indexOf(k) < 0 ? ORDER.length : ORDER.indexOf(k));

function show(v: unknown): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDate(v);
    if (/^[a-z]+(_[a-z]+)*$/.test(v)) return label(v);
    return v;
  }
  if (v && typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([a, b]) => `${label(a)}: ${show(b)}`).join(" · ");
  return String(v);
}

function ToolChip({ part }: { part: Extract<Part, { kind: "tool" }> }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-xs", part.status === "error" ? "text-warning" : "text-muted-foreground")} title={part.detail}>
      {part.status === "running" ? <Loader2Icon className="size-3 animate-spin" /> : part.status === "error" ? <AlertCircleIcon className="size-3" /> : <CheckIcon className="size-3 text-success" />}
      <span>{part.label}</span>
      {part.status === "error" && part.detail && <span className="truncate">· {part.detail}</span>}
    </div>
  );
}

function ProposalCard({ action, onChange }: { action: ProposalView; onChange: (a: ProposalView) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const decided = action.status !== "proposed";
  const rows = Object.entries(action.preview)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .sort(([a], [b]) => rank(a) - rank(b));
  return (
    <div className={cn("rounded-lg border p-3", decided ? "bg-surface-2/40" : "border-gold/50 bg-gold-wash")} data-testid="proposal-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{action.summary}</p>
        {decided && (
          <Badge variant={action.status === "executed" ? "success" : action.status === "failed" ? "danger" : "outline"}>
            {action.status === "executed" ? "Done" : label(action.status)}
          </Badge>
        )}
      </div>
      {rows.length > 0 && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{label(k)}</dt>
              <dd className="min-w-0 break-words">{show(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {action.status === "failed" && action.error && <p className="mt-2 text-xs text-danger">{action.error}</p>}
      {action.status === "executed" && action.result?.href && (
        <Link href={action.result.href} scroll={false} className="mt-2 inline-block text-xs font-medium text-gold-ink hover:underline">
          {action.result.message ?? "Open"} →
        </Link>
      )}
      {!decided && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await confirmAgentAction(action.id);
                if (!r.ok) {
                  toast.error(r.error);
                  onChange({ ...action, status: "failed", error: r.error });
                  return;
                }
                onChange(r.data.action);
                toast.success(r.data.action.result?.message ?? "Done");
                router.refresh();
              })
            }
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Confirm
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await rejectAgentAction(action.id);
                if (!r.ok) return void toast.error(r.error);
                onChange(r.data.action);
              })
            }
          >
            <XIcon /> Reject
          </Button>
        </div>
      )}
    </div>
  );
}

function DraftCard({ to, subject, body }: { to: string; subject: string; body: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border p-3" data-testid="draft-card">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <MailIcon className="size-3.5" /> Draft email · not sent
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(`To: ${to}\nSubject: ${subject}\n\n${body}`);
            setCopied(true);
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-1 text-xs">
        <span className="text-muted-foreground">To</span> {to}
      </p>
      <p className="text-xs">
        <span className="text-muted-foreground">Subject</span> {subject}
      </p>
      <pre className="mt-2 font-sans text-sm whitespace-pre-wrap">{body}</pre>
    </div>
  );
}

export function ChatMessages({ items, streaming, onActionChange }: { items: ChatItem[]; streaming: boolean; onActionChange: (a: ProposalView) => void }) {
  return (
    <div className="space-y-5">
      {items.map((it, i) =>
        it.role === "user" ? (
          <div key={i} className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap">
            {it.text}
          </div>
        ) : (
          <div key={i} className="space-y-2" data-testid="assistant-message">
            {it.parts.length === 0 && streaming && i === items.length - 1 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2Icon className="size-3 animate-spin" /> Thinking…
              </p>
            )}
            {it.parts.map((p, j) =>
              p.kind === "text" ? (
                <Markdown key={j} text={p.text} />
              ) : p.kind === "tool" ? (
                <ToolChip key={j} part={p} />
              ) : p.kind === "proposal" ? (
                <ProposalCard key={j} action={p.action} onChange={onActionChange} />
              ) : (
                <DraftCard key={j} to={p.to} subject={p.subject} body={p.body} />
              ),
            )}
          </div>
        ),
      )}
    </div>
  );
}

export function Composer({ onSend, onStop, streaming, autoFocus, initial }: { onSend: (t: string) => void; onStop: () => void; streaming: boolean; autoFocus?: boolean; initial?: string }) {
  const [text, setText] = useState(initial ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const submit = () => {
    if (!text.trim() || streaming) return;
    onSend(text);
    setText("");
  };
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Ask about deals, tasks, contracts, documents…"
        aria-label="Message Ask Lantana"
        className="max-h-40 min-h-10 resize-none"
        maxLength={8000}
      />
      {streaming ? (
        <Button type="button" variant="outline" size="icon" onClick={onStop} aria-label="Stop">
          <SquareIcon className="size-3.5" />
        </Button>
      ) : (
        <Button type="submit" size="icon" disabled={!text.trim()} aria-label="Send">
          <ArrowUpIcon />
        </Button>
      )}
    </form>
  );
}

export function EmptyState({ onPick, disabledReason }: { onPick: (q: string) => void; disabledReason?: string | null }) {
  return (
    <div className="space-y-3">
      {disabledReason ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">{disabledReason}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ask about anything in Lantana Command. It works with your permissions, links every figure to its record, and asks before it changes anything.
        </p>
      )}
      <div className="grid gap-2">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            type="button"
            disabled={Boolean(disabledReason)}
            onClick={() => onPick(e)}
            className="flex items-center gap-2 rounded-md border bg-surface-2/40 px-3 py-2 text-left text-sm transition-colors hover:border-gold/50 hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-60"
          >
            <CircleIcon className="size-1.5 shrink-0 fill-gold text-gold" /> {e}
          </button>
        ))}
      </div>
    </div>
  );
}
