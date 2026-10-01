import { notFound } from "next/navigation";
import { getSession } from "@/server/session";
import { PageHeader } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";

const TABS = [
  { href: "/compliance", label: "Obligations", exact: true },
  { href: "/compliance/records", label: "Corporate records" },
  { href: "/compliance/governance", label: "Meetings & resolutions" },
];

/** Compliance is management-only (RLS); staff get the same not-found as a hidden record. */
export default async function ComplianceLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.isManagerPlus) notFound();
  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Compliance" description="Licences, filings, corporate records and governance for Lantana Vision FZ-LLC." className="mb-4" />
      <SectionTabs items={TABS} label="Compliance sections" />
      {children}
    </div>
  );
}
