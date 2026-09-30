"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { wipeDemoData } from "@/server/actions/settings";

export function WipeDemo({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), setText(""))}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={disabled}>
          <Trash2Icon /> Wipe demo data
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Wipe all demo data?</DialogTitle>
        <DialogDescription className="mt-2">
          This permanently deletes every record marked as demo: deals, partners, contracts, tasks, documents, the demo ledger and demo introductions.
          Real records are untouched. If any real record points at a demo record, nothing is deleted and you&apos;ll see which one. The wipe is written to the audit log.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await wipeDemoData(text);
              if (r.ok) {
                const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
                toast.success(`Demo data removed (${total} records).`);
                setOpen(false);
              } else toast.error(r.error);
            });
          }}
        >
          <label className="block text-sm" htmlFor="wipe-confirm">
            Type <span className="num text-foreground">WIPE DEMO DATA</span> to confirm
          </label>
          <Input id="wipe-confirm" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending || text.trim() !== "WIPE DEMO DATA"}>
              {pending && <Loader2Icon className="animate-spin" />} Delete demo data
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
