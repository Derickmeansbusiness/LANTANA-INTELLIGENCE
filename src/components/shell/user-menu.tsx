"use client";

import { useTheme } from "next-themes";
import { useTransition } from "react";
import { ChevronsUpDownIcon, LogOutIcon, MoonIcon, ShieldAlertIcon, SunIcon, UserRoundCogIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { devSwitchAccount, signOut } from "@/app/login/actions";
import type { ShellUser } from "./types";

const ROLE_LABEL = { principal: "Principal", manager: "Manager", staff: "Staff", external: "External" } as const;
const DEV_ACCOUNTS = [
  { email: "maimouna@lantana.test", label: "Maimouna (Principal)" },
  { email: "fai@lantana.test", label: "Fai (Principal)" },
  { email: "manager@lantana.test", label: "Test Manager" },
  { email: "staff@lantana.test", label: "Test Staff" },
  { email: "guest@lantana.test", label: "Test Guest (data room)" },
];

export function UserMenu({ user, collapsed }: { user: ShellUser; collapsed: boolean }) {
  const { theme, setTheme } = useTheme();
  const [pending, start] = useTransition();
  const devLogin = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md p-1.5 text-left outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring",
          collapsed && "flex-none",
        )}
        aria-label="Account menu"
      >
        <Avatar name={user.fullName} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{user.fullName}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{ROLE_LABEL[user.role]}</span>
            </span>
            <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuLabel className="space-y-1">
          <span className="block text-sm text-foreground">{user.fullName}</span>
          <span className="block truncate">{user.email}</span>
          <span className="flex gap-1 pt-0.5">
            <Badge variant={user.role === "principal" ? "gold" : "default"}>{ROLE_LABEL[user.role]}</Badge>
            {user.role === "principal" && !user.isPrincipal && (
              <Badge variant="warning">
                <ShieldAlertIcon className="size-3" /> MFA pending
              </Badge>
            )}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon className="size-4 text-muted-foreground" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <SunIcon className="size-4 text-muted-foreground" /> Light
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {devLogin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5">
              <UserRoundCogIcon className="size-3.5" /> Switch test account (local only)
            </DropdownMenuLabel>
            {DEV_ACCOUNTS.filter((a) => a.email !== user.email).map((a) => (
              <DropdownMenuItem
                key={a.email}
                disabled={pending}
                onSelect={() => start(() => devSwitchAccount(a.email))}
              >
                {a.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => start(() => signOut())}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
