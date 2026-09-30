"use client";

import { useEffect, useState } from "react";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Notification = { id: string; title: string; body: string | null; created_at: string; read_at: string | null };

export function NotificationsBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const unread = items.filter((i) => !i.read_at).length;

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase
      .from("notifications")
      .select("id, title, body, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (cancelled) return;
        setItems(data ?? []);
        setLoaded(true);
      });
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (p) =>
        setItems((prev) => [p.new as Notification, ...prev].slice(0, 20)),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function markAllRead() {
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: now })));
    await createClient().from("notifications").update({ read_at: now }).in("id", ids);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <BellIcon />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-gold ring-2 ring-background" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={!unread}>
            <CheckCheckIcon /> Mark all read
          </Button>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {loaded && items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</li>}
          {items.map((n) => (
            <li key={n.id} className={cn("border-b px-3 py-2.5 last:border-0", !n.read_at && "bg-gold-wash/40")}>
              <p className="text-sm">{n.title}</p>
              {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">{relativeTime(n.created_at)}</p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
