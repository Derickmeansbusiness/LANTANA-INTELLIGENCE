"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrandMark, Wordmark } from "@/components/brand-mark";
import { navFor, isActive, NAV } from "./nav";
import { UserMenu } from "./user-menu";
import { CommandPalette } from "./command-palette";
import { NotificationsBell } from "./notifications-bell";
import { AgentPanel } from "./agent-panel";
import { DateRangePicker } from "./date-range-picker";
import { RecordSheet } from "./record-sheet";
import type { ShellUser } from "./types";

const COLLAPSE_KEY = "lc.sidebar.collapsed";

// Sidebar preference lives in localStorage; read it without a hydration mismatch.
const collapseListeners = new Set<() => void>();
const collapseStore = {
  subscribe(l: () => void) {
    collapseListeners.add(l);
    return () => collapseListeners.delete(l);
  },
  get() {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  },
  set(v: boolean) {
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
    } catch {}
    collapseListeners.forEach((l) => l());
  },
};

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useSyncExternalStore(collapseStore.subscribe, collapseStore.get, () => false);
  // The drawer remembers the path it was opened on, so navigating closes it.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const mobileOpen = drawerPath === pathname;
  const setMobileOpen = (o: boolean) => setDrawerPath(o ? pathname : null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const pendingG = useRef<number | null>(null);

  const toggleCollapsed = useCallback(() => collapseStore.set(!collapseStore.get()), []);

  // Keyboard: ⌘K palette, ⌘J agent, ⌘B sidebar, "g h/d/p/t" navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAgentOpen((o) => !o);
      } else if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
      } else if (!mod && !typing && e.key.toLowerCase() === "g") {
        pendingG.current = window.setTimeout(() => (pendingG.current = null), 800);
      } else if (!mod && !typing && pendingG.current) {
        const hit = NAV.find((n) => n.shortcut?.toLowerCase() === `g ${e.key.toLowerCase()}`);
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        if (hit && hit.roles.includes(user.role)) router.push(hit.href);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, toggleCollapsed, user.role]);

  const items = navFor(user.role);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-surface transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[64px]" : "w-[240px]",
        )}
      >
        <SidebarBody items={items} pathname={pathname} collapsed={collapsed} user={user} onToggle={toggleCollapsed} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[272px] sm:max-w-[272px]">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody items={items} pathname={pathname} collapsed={false} user={user} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <MenuIcon />
          </Button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border bg-surface px-3 text-left text-sm text-muted-foreground transition-colors hover:border-gold-soft/60 sm:max-w-md"
            aria-label="Search or jump to (Ctrl+K)"
          >
            <SearchIcon className="size-4 shrink-0" />
            <span className="truncate">Search or jump to…</span>
            <kbd className="num ml-auto hidden rounded border px-1.5 py-0.5 text-[10px] sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Suspense fallback={null}>
              <DateRangePicker />
            </Suspense>
            <NotificationsBell userId={user.id} />
            <Button onClick={() => setAgentOpen(true)} size="sm" className="gap-1.5" aria-label="Ask Lantana (Ctrl+J)">
              <SparklesIcon />
              <span className="hidden sm:inline">Ask Lantana</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</main>
      </div>

      <Suspense fallback={null}>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={user.role} onAsk={() => setAgentOpen(true)} />
      </Suspense>
      <AgentPanel open={agentOpen} onOpenChange={setAgentOpen} />
      <Suspense fallback={null}>
        <RecordSheet />
      </Suspense>
    </div>
  );
}

function SidebarBody({
  items,
  pathname,
  collapsed,
  user,
  onToggle,
}: {
  items: ReturnType<typeof navFor>;
  pathname: string;
  collapsed: boolean;
  user: ShellUser;
  onToggle?: () => void;
}) {
  return (
    <>
      <div className={cn("flex h-14 items-center gap-2.5 border-b px-4", collapsed && "justify-center px-0")}>
        <Link href="/" className="flex items-center gap-2.5" aria-label="Lantana Command home">
          <BrandMark />
          {!collapsed && <Wordmark />}
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Modules">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const link = (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground",
                active && "bg-surface-2 text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              {active && <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-gold" aria-hidden />}
              <item.icon className={cn("size-4 shrink-0", active && "text-gold")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && item.phase > 1 && item.href !== "/settings" && (
                <span className="num ml-auto text-[10px] text-muted-foreground/70">P{item.phase}</span>
              )}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>
      <div className={cn("flex items-center gap-1 border-t p-2", collapsed && "flex-col")}>
        <UserMenu user={user} collapsed={collapsed} />
        {onToggle && (
          <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          </Button>
        )}
      </div>
    </>
  );
}
