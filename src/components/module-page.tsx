import { LockIcon } from "lucide-react";
import { NAV } from "@/components/shell/nav";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";
import { getSession } from "@/server/session";

const BULLETS: Record<string, string[]> = {
  "/deals": [
    "Kanban and table views across all ten stages, with saved views and CSV export",
    "Deal record pages with a timeline of every stage change",
    "The introductions ledger: append-only, hash-chained, exportable as a dated PDF",
    "Weighted pipeline forecast",
  ],
  "/partners": [
    "Directory of investors, project owners, partners, introducers and government contacts",
    "Organization profiles with contacts, deals, agreements and an interaction timeline",
    "“Who do we know for this?” investor matcher ranked on sector, geography and ticket fit",
  ],
  "/tasks": [
    "List, board, calendar, timeline and My day views",
    "Projects with milestones, dependencies, checklists and comments",
    "Recurring tasks for payroll runs and VAT quarters",
  ],
  "/documents": [
    "Folder tree, tags and metadata, with drag-and-drop upload",
    "In-browser preview, version history and check-in/out",
    "Semantic search across every clause, including scanned PDFs",
    "Templates on the Lantana letterhead, generated as DOCX and PDF",
  ],
  "/contracts": [
    "Register with renewal type, notice periods, survival clauses and forum",
    "Obligations that become tasks automatically",
    "Alerts at 90/60/30/7 days before expiry, notice deadlines and survival ends",
  ],
  "/people": [
    "Employee profiles with visa, Emirates ID and labour card expiries",
    "Leave requests, onboarding and offboarding checklists",
    "Payroll (principals only) with WPS status and salary certificates from the actual payroll record",
  ],
  "/finance": [
    "AED ledger with USD, EUR, XAF, TZS and NGN at stored daily rates",
    "Invoices, receivables aging, bills, budgets vs actuals",
    "P&L, cash flow, burn and runway",
  ],
  "/compliance": [
    "Corporate profile: licence, shareholders, signatories, bank accounts (masked)",
    "Expiry tracker for licences, leases, insurance and visas",
    "Only obligations a principal has confirmed drive alerts",
  ],
  "/reports": [
    "Weekly management pack and monthly board pack on letterhead",
    "Report builder with saved and scheduled reports",
    "Every chart exportable as PNG or CSV",
  ],
  "/agent": [
    "Chat with Ask Lantana using your own permissions",
    "Confirmation cards before any change, with a before/after view",
    "Daily 07:30 Dubai briefing, nightly scans and a Monday digest",
  ],
};

export async function ModulePage({ href }: { href: string }) {
  const item = NAV.find((n) => n.href === href)!;
  const session = await getSession();
  if (!item.roles.includes(session.role)) {
    return (
      <>
        <PageHeader title={item.label} description={item.description} />
        <div className="flex items-center gap-3 rounded-lg border p-6 text-sm text-muted-foreground">
          <LockIcon className="size-4" /> Your role doesn&apos;t have access to this module. Ask a principal if you need it.
        </div>
      </>
    );
  }
  return (
    <ComingSoon
      title={item.label}
      description={item.description}
      phase={item.phase}
      icon={item.icon}
      bullets={BULLETS[href] ?? []}
      meanwhile={{ label: "Back to the Command Center", href: "/" }}
    />
  );
}
