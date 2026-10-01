import { notFound } from "next/navigation";
import { getSession } from "@/server/session";
import { SectionTabs } from "@/components/section-tabs";
import { PageHeader } from "@/components/page-header";

const TABS = [
  { href: "/finance", label: "Overview", exact: true },
  { href: "/finance/ledger", label: "Ledger" },
  { href: "/finance/invoices", label: "Invoices" },
  { href: "/finance/bills", label: "Bills" },
  { href: "/finance/budgets", label: "Budgets" },
  { href: "/finance/fx", label: "FX rates" },
];

/** Finance is management-only (RLS); staff get the same not-found as a hidden record. */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.isManagerPlus) notFound();
  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Finance"
        description={
          session.isPrincipal
            ? "Ledger, invoices, bills, budgets and cash, in AED at each day's rate."
            : "Ledger, invoices, bills and budgets, in AED at each day's rate. Cash and bank balances are visible to principals only."
        }
        className="mb-4"
      />
      <SectionTabs items={TABS} label="Finance sections" />
      {children}
    </div>
  );
}
