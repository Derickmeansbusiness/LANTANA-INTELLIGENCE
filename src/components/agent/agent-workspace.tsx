"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArchiveIcon, MessageSquareIcon, MoreHorizontalIcon, PencilIcon, PinIcon, PinOffIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { listThreadsAction, updateThreadAction } from "@/server/actions/agent";
import type { ThreadSummary } from "@/server/agent/view-types";
import { ChatMessages, Composer, EmptyState } from "./chat";
import { useAgent } from "./use-agent";
import { RelativeTime } from "@/components/relative-time";

export function AgentWorkspace({ threads: initial, enabled }: { threads: ThreadSummary[]; enabled: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const wanted = search.get("thread");
  const [threads, setThreads] = useState(initial);
  const [, start] = useTransition();
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const refreshList = useCallback(() => start(async () => setThreads(await listThreadsAction())), []);
  const onThread = useCallback(
    (id: string) => {
      router.replace(`${pathname}?thread=${id}`, { scroll: false });
      refreshList();
    },
    [pathname, refreshList, router],
  );
  const agent = useAgent(onThread);
  const { load, threadId } = agent;

  // Follow ?thread= (deep links from the panel, back/forward).
  useEffect(() => {
    if ((wanted ?? null) !== threadId) void load(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [agent.items]);

  const open = (id: string | null) => router.replace(id ? `${pathname}?thread=${id}` : pathname, { scroll: false });
  const patch = (id: string, p: { title?: string; pinned?: boolean; archived?: boolean }) =>
    start(async () => {
      const r = await updateThreadAction(id, p);
      if (!r.ok) return void toast.error(r.error);
      if (p.archived && id === threadId) open(null);
      setThreads(await listThreadsAction());
    });

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-[1440px] gap-5">
      <aside className="hidden w-64 shrink-0 flex-col lg:flex" aria-label="Conversations">
        <Button variant="outline" size="sm" className="mb-3 justify-start" onClick={() => open(null)}>
          <PlusIcon /> New conversation
        </Button>
        <ul className="flex-1 space-y-0.5 overflow-y-auto">
          {threads.length === 0 && <li className="px-2 text-xs text-muted-foreground">No conversations yet.</li>}
          {threads.map((t) => (
            <li key={t.id} className="group relative">
              <button
                type="button"
                onClick={() => open(t.id)}
                aria-current={t.id === threadId ? "page" : undefined}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2.5 py-2 pr-8 text-left text-sm transition-colors",
                  t.id === threadId ? "bg-gold-wash text-gold-ink" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                {t.pinned ? <PinIcon className="mt-0.5 size-3.5 shrink-0" /> : <MessageSquareIcon className="mt-0.5 size-3.5 shrink-0" />}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2">{t.title}</span>
                  <span className="text-xs opacity-70"><RelativeTime ts={t.updated_at} /></span>
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="absolute top-1 right-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100" aria-label={`Options for ${t.title}`}>
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => patch(t.id, { pinned: !t.pinned })}>
                    {t.pinned ? <PinOffIcon /> : <PinIcon />} {t.pinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setRenaming({ id: t.id, title: t.title })}>
                    <PencilIcon /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => patch(t.id, { archived: true })}>
                    <ArchiveIcon /> Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      </aside>

      <Dialog open={Boolean(renaming)} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Rename conversation</DialogTitle>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (renaming?.title.trim()) patch(renaming.id, { title: renaming.title });
              setRenaming(null);
            }}
          >
            <Input aria-label="Title" value={renaming?.title ?? ""} onChange={(e) => setRenaming((r) => r && { ...r, title: e.target.value })} maxLength={200} autoFocus />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renaming?.title.trim()}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <section className="flex min-w-0 flex-1 flex-col rounded-lg border bg-surface">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <h1 className="flex flex-1 items-center gap-2 font-display text-lg whitespace-nowrap">
            <SparklesIcon className="size-4 text-gold" /> Ask Lantana
          </h1>
          <div className="w-36 min-w-0 lg:hidden">
            <NativeSelect aria-label="Conversation" value={threadId ?? ""} onChange={(e) => open(e.target.value || null)}>
              <option value="">New conversation</option>
              {threads.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div ref={scroller} className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-3xl">
            {agent.items.length === 0 ? (
              <EmptyState onPick={(q) => agent.send(q, { path: "/agent" })} disabledReason={enabled ? null : "Ask Lantana needs an Anthropic API key on the server (ANTHROPIC_API_KEY)."} />
            ) : (
              <ChatMessages items={agent.items} streaming={agent.streaming} onActionChange={agent.updateAction} />
            )}
            {agent.error && (
              <p role="alert" className="mt-4 rounded-md border border-danger/40 bg-danger/10 p-2.5 text-sm text-danger">
                {agent.error}
              </p>
            )}
          </div>
        </div>
        <div className="border-t p-4">
          <div className="mx-auto max-w-3xl">
            {enabled ? <Composer onSend={(t) => agent.send(t, { path: "/agent" })} onStop={agent.stop} streaming={agent.streaming} autoFocus /> : <p className="text-xs text-muted-foreground">Unavailable until an API key is configured.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
