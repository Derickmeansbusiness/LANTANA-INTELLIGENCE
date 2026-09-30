"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Building2Icon,
  CheckSquareIcon,
  FileTextIcon,
  KanbanSquareIcon,
  MoonIcon,
  ScrollTextIcon,
  SparklesIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { searchEverything } from "@/server/actions/records";
import type { SearchHit } from "@/server/records-shared";
import { navFor } from "./nav";
import type { Role } from "@/server/session";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  deal: KanbanSquareIcon,
  organization: Building2Icon,
  contact: UserIcon,
  task: CheckSquareIcon,
  document: FileTextIcon,
  contract: ScrollTextIcon,
};

export function CommandPalette({
  open,
  onOpenChange,
  role,
  onAsk,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  role: Role;
  onAsk: (q: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState("");
  const [searching, start] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = window.setTimeout(() => start(async () => {
          const found = await searchEverything(q);
          setHits(found);
          // Results arrive after typing; move the highlight to the best match so Enter opens it.
          if (found[0]) setSelected(`${found[0].entityType}:${found[0].entityId}`);
        }), 160);
    return () => window.clearTimeout(t);
  }, [query]);

  function setOpen(o: boolean) {
    if (!o) setQuery("");
    onOpenChange(o);
  }

  function go(fn: () => void) {
    setOpen(false);
    fn();
  }

  function openRecord(hit: SearchHit) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("record", `${hit.entityType}:${hit.entityId}`);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const nav = navFor(role);
  const q = query.trim();
  const shownHits = q.length < 2 ? [] : hits;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showClose={false} className="top-[10vh] max-w-xl overflow-hidden p-0">
        <DialogTitle className="sr-only">Search or jump to</DialogTitle>
        <Command shouldFilter={false} loop value={selected} onValueChange={setSelected}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search deals, partners, tasks, documents… or ask a question" />
          <CommandList>
            <CommandEmpty>{searching ? "Searching…" : "No matches."}</CommandEmpty>
            {shownHits.length > 0 && (
              <CommandGroup heading="Records">
                {shownHits.map((h) => {
                  const Icon = ICONS[h.entityType] ?? FileTextIcon;
                  return (
                    <CommandItem key={`${h.entityType}:${h.entityId}`} value={`${h.entityType}:${h.entityId}`} onSelect={() => go(() => openRecord(h))}>
                      <Icon />
                      <span className="truncate">{h.title}</span>
                      <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">{h.subtitle}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {q.length > 0 && (
              <CommandGroup heading="Ask Lantana">
                <CommandItem value="ask" onSelect={() => go(() => onAsk(q))}>
                  <SparklesIcon className="!text-gold" />
                  <span className="truncate">Ask: &ldquo;{q}&rdquo;</span>
                  <CommandShortcut>Phase 4</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Go to">
              {nav
                .filter((n) => !q || n.label.toLowerCase().includes(q.toLowerCase()))
                .map((n) => (
                  <CommandItem key={n.href} value={`nav:${n.href}`} onSelect={() => go(() => router.push(n.href))}>
                    <n.icon />
                    {n.label}
                    {n.shortcut && <CommandShortcut className="num">{n.shortcut}</CommandShortcut>}
                  </CommandItem>
                ))}
            </CommandGroup>
            {(!q || "theme dark light".includes(q.toLowerCase())) && (
              <CommandGroup heading="Preferences">
                <CommandItem value="theme" onSelect={() => go(() => setTheme(theme === "dark" ? "light" : "dark"))}>
                  {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                  Switch to {theme === "dark" ? "light" : "dark"} theme
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
