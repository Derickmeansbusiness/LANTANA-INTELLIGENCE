"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/dates";
import { Avatar } from "@/components/ui/avatar";
import type { ActivityRow } from "@/server/command-center";

const LINKABLE = new Set(["deal", "task", "contract", "document", "organization"]);

/** Live feed over activity_events (sanitised, RLS-scoped). Never the raw audit log. */
export function ActivityFeed({ initial, names }: { initial: ActivityRow[]; names: Record<string, string> }) {
  const [rows, setRows] = useState(initial);
  const [, tick] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("activity-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_events" }, async (p) => {
        // Re-read the row rather than trusting the payload: same query and
        // RLS as the server render, and a well-formed timestamp.
        const id = (p.new as { id?: number }).id;
        if (id == null) return;
        const { data } = await supabase
          .from("activity_events")
          .select("id, occurred_at, verb, summary, entity_type, entity_id, actor:profiles(full_name)")
          .eq("id", id)
          .maybeSingle();
        if (!data) return;
        const row: ActivityRow = { ...data, actor: (data.actor as { full_name: string } | null)?.full_name ?? null };
        setRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev].slice(0, 40)));
      })
      .subscribe();
    const t = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(t);
    };
  }, [names]);

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No activity yet. Changes across the company show up here as they happen.</p>;
  }

  return (
    <ol className="space-y-3" aria-live="polite">
      {rows.map((r) => {
        const body = (
          <>
            <span className="text-foreground">{r.actor ?? "System"}</span> <span className="text-muted-foreground">{r.summary}</span>
          </>
        );
        return (
          <li key={r.id} className="flex gap-2.5">
            <Avatar name={r.actor ?? "System"} className="mt-0.5 size-6 text-[10px]" />
            <div className="min-w-0 text-sm leading-snug">
              {r.entity_id && LINKABLE.has(r.entity_type) ? (
                <Link href={`?record=${r.entity_type}:${r.entity_id}`} scroll={false} className="hover:underline">
                  {body}
                </Link>
              ) : (
                body
              )}
              <p className="num mt-0.5 text-[11px] text-muted-foreground">{relativeTime(r.occurred_at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
