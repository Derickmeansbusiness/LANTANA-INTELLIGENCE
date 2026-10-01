import {
  LayoutDashboardIcon,
  KanbanSquareIcon,
  Building2Icon,
  CheckSquareIcon,
  FolderLockIcon,
  ScrollTextIcon,
  UsersIcon,
  LandmarkIcon,
  ShieldCheckIcon,
  BarChart3Icon,
  SettingsIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/server/session";

/** The phase currently shipped. Modules from later phases show a "P<n>" tag. */
export const CURRENT_PHASE = 4;

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: Role[];
  phase: number;
  shortcut?: string;
};

const ALL: Role[] = ["principal", "manager", "staff"];
const MGMT: Role[] = ["principal", "manager"];

export const NAV: NavItem[] = [
  { href: "/", label: "Command Center", description: "What needs attention and how the company is doing.", icon: LayoutDashboardIcon, roles: ALL, phase: 1, shortcut: "G H" },
  { href: "/deals", label: "Deals", description: "Pipeline, introductions ledger and forecast.", icon: KanbanSquareIcon, roles: ALL, phase: 2, shortcut: "G D" },
  { href: "/partners", label: "Partners & Investors", description: "Organizations, contacts and relationship history.", icon: Building2Icon, roles: ALL, phase: 2, shortcut: "G P" },
  { href: "/tasks", label: "Tasks & Projects", description: "Everything with an owner and a due date.", icon: CheckSquareIcon, roles: ALL, phase: 2, shortcut: "G T" },
  { href: "/documents", label: "Documents", description: "The vault: agreements, letters, templates and search.", icon: FolderLockIcon, roles: ALL, phase: 3 },
  { href: "/contracts", label: "Contracts", description: "Register, obligations, renewals and survival periods.", icon: ScrollTextIcon, roles: MGMT, phase: 3 },
  { href: "/people", label: "People & HR", description: "Team, leave, visas and payroll.", icon: UsersIcon, roles: MGMT, phase: 5 },
  { href: "/finance", label: "Finance", description: "Ledger, invoices, budgets and cash.", icon: LandmarkIcon, roles: MGMT, phase: 5 },
  { href: "/compliance", label: "Compliance", description: "Licences, filings, corporate records and expiries.", icon: ShieldCheckIcon, roles: MGMT, phase: 5 },
  { href: "/reports", label: "Reports", description: "Management packs, board packs and the report builder.", icon: BarChart3Icon, roles: MGMT, phase: 6 },
  { href: "/agent", label: "Ask Lantana", description: "The AI agent, full page.", icon: SparklesIcon, roles: ALL, phase: 4 },
  { href: "/settings", label: "Settings", description: "Company, users, audit log and demo data.", icon: SettingsIcon, roles: ALL, phase: 1 },
];

export function navFor(role: Role) {
  return NAV.filter((n) => n.roles.includes(role));
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
