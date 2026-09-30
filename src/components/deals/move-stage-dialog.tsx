"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { moveDealStageAction } from "@/server/actions/deals";

export type PendingMove = { dealId: string; dealName: string; stage: string; stageLabel: string; terminal: boolean } | null;

/** Asks for the reason behind a stage change. Required for won/lost. */
export function MoveStageDialog({ move, onClose, onMoved }: { move: PendingMove; onClose: () => void; onMoved?: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  return (
    <Dialog open={Boolean(move)} onOpenChange={(o) => !o && (onClose(), setNote(""))}>
      <DialogContent className="max-w-md">
        {move && (
          <>
            <DialogTitle>Move to {move.stageLabel}</DialogTitle>
            <DialogDescription className="mt-1">
              {move.dealName}. {move.terminal ? "Say why it closed. This stays on the deal's history." : "Optional: add context for the history."}
            </DialogDescription>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await moveDealStageAction({ dealId: move.dealId, stage: move.stage, note });
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(`Moved to ${move.stageLabel}`);
                  setNote("");
                  onClose();
                  onMoved?.();
                  router.refresh();
                });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="stage-note">{move.terminal ? "Reason (required)" : "Note"}</Label>
                <Textarea id="stage-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus required={move.terminal} maxLength={1000} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending || (move.terminal && !note.trim())}>
                  {pending && <Loader2Icon className="animate-spin" />}
                  Move deal
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
