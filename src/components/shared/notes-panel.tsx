"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { ArchiveIcon, PinIcon, PinOffIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addNoteAction, updateNoteAction } from "@/server/actions/relationships";
import { RelativeTime } from "@/components/relative-time";

export type NoteItem = { id: string; body: string; pinned: boolean; created_at: string; author: { full_name: string } | null };

export function NotesPanel({ entityType, entityId, notes }: { entityType: "deal" | "organization" | "project"; entityId: string; notes: NoteItem[] }) {
  const path = usePathname();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addNoteAction({ entityType, entityId, body });
            if (!r.ok) return void toast.error(r.error);
            setBody("");
          });
        }}
        className="space-y-2"
      >
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note…" rows={2} aria-label="New note" maxLength={10000} />
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="secondary" disabled={pending || !body.trim()}>
            Add note
          </Button>
        </div>
      </form>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className={cn("group rounded-md border p-3 text-sm", n.pinned && "border-gold/40 bg-gold-wash/30")}>
              <p className="leading-relaxed whitespace-pre-wrap">{n.body}</p>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                {n.pinned && <PinIcon className="size-3 text-gold" />}
                <span>
                  {n.author?.full_name ?? "Someone"} · <RelativeTime ts={n.created_at} />
                </span>
                <span className="ml-auto flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6"
                    aria-label={n.pinned ? "Unpin note" : "Pin note"}
                    onClick={() => start(async () => {
                      const r = await updateNoteAction(n.id, { pinned: !n.pinned }, path);
                      if (!r.ok) toast.error(r.error);
                    })}
                  >
                    {n.pinned ? <PinOffIcon /> : <PinIcon />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6"
                    aria-label="Archive note"
                    onClick={() => start(async () => {
                      const r = await updateNoteAction(n.id, { archived: true }, path);
                      if (!r.ok) toast.error(r.error);
                      else toast.success("Note archived");
                    })}
                  >
                    <ArchiveIcon />
                  </Button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
