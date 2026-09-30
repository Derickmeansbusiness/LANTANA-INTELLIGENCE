"use client";

import { SparklesIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const EXAMPLES = [
  "What changed in the pipeline this week?",
  "Draft a follow-up to the Ministry on the fertilizer proposal",
  "Which investors fit the Dodoma mini-grid portfolio?",
  "When is the last day to give notice on the Faminas mandate?",
];

/** Placeholder until Phase 4 wires the Claude tool-use loop. */
export function AgentPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <div className="border-b p-5 pr-12">
          <SheetTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-gold" /> Ask Lantana
          </SheetTitle>
          <SheetDescription className="mt-1">
            The agent arrives in Phase 4. It will act with your permissions, show a confirmation card before any change, and cite the records behind every number.
          </SheetDescription>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-5">
          <p className="text-xs text-muted-foreground">The kind of thing you&apos;ll be able to ask:</p>
          {EXAMPLES.map((e) => (
            <div key={e} className="rounded-md border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground">
              {e}
            </div>
          ))}
        </div>
        <form className="flex gap-2 border-t p-4" onSubmit={(e) => e.preventDefault()}>
          <Input disabled placeholder="Available in Phase 4" aria-label="Message Ask Lantana" />
          <Button disabled>Send</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
