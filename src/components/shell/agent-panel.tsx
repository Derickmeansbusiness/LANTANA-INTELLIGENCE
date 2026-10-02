"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Maximize2Icon, PlusIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ChatMessages, Composer, EmptyState } from "@/components/agent/chat";
import { contextFrom, useAgent } from "@/components/agent/use-agent";

/**
 * Ask Lantana as a slide-over, available on every page (Ctrl+J). It knows the
 * page and record you have open, keeps the conversation while closed, and can
 * hand off to the full page at /agent.
 */
export function AgentPanel({
  open,
  onOpenChange,
  enabled,
  question,
  onQuestionTaken,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  enabled: boolean;
  question: string | null;
  onQuestionTaken: () => void;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const agent = useAgent();
  const { send } = agent;
  const scroller = useRef<HTMLDivElement>(null);
  const ctx = () => contextFrom(pathname, new URLSearchParams(search.toString()));

  // A question typed into Ctrl+K arrives here once. The panel now mounts with
  // the question already set, so guard against the effect running twice.
  const taken = useRef<string | null>(null);
  useEffect(() => {
    if (open && question && enabled && taken.current !== question) {
      taken.current = question;
      onQuestionTaken();
      void send(question, contextFrom(pathname, new URLSearchParams(search.toString())));
    }
  }, [open, question, enabled, onQuestionTaken, send, pathname, search]);
  useEffect(() => {
    if (!question) taken.current = null;
  }, [question]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [agent.items]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg" aria-describedby={undefined}>
        <div className="flex items-center gap-2 border-b py-3 pr-12 pl-5">
          <SheetTitle className="flex flex-1 items-center gap-2">
            <SparklesIcon className="size-4 text-gold" /> Ask Lantana
          </SheetTitle>
          <SheetDescription className="sr-only">Chat with the Lantana assistant</SheetDescription>
          {agent.items.length > 0 && (
            <Button variant="ghost" size="icon-sm" aria-label="New conversation" onClick={() => agent.load(null)} disabled={agent.streaming}>
              <PlusIcon />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={agent.threadId ? `/agent?thread=${agent.threadId}` : "/agent"} aria-label="Open full page" onClick={() => onOpenChange(false)}>
              <Maximize2Icon />
            </Link>
          </Button>
        </div>
        <div ref={scroller} className="flex-1 overflow-y-auto p-5">
          {agent.items.length === 0 ? (
            <EmptyState onPick={(q) => send(q, ctx())} disabledReason={enabled ? null : "Ask Lantana needs an Anthropic API key on the server (ANTHROPIC_API_KEY). A principal can add it in the hosting settings."} />
          ) : (
            <ChatMessages items={agent.items} streaming={agent.streaming} onActionChange={agent.updateAction} />
          )}
          {agent.error && (
            <p role="alert" className="mt-4 rounded-md border border-danger/40 bg-danger/10 p-2.5 text-sm text-danger">
              {agent.error}
            </p>
          )}
        </div>
        <div className="border-t p-4">
          {enabled ? (
            <Composer onSend={(t) => send(t, ctx())} onStop={agent.stop} streaming={agent.streaming} autoFocus={open} />
          ) : (
            <p className="text-xs text-muted-foreground">Unavailable until an API key is configured.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
