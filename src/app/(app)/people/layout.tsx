import { getSession } from "@/server/session";
import { PageHeader } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";

export default async function PeopleLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const tabs = [
    { href: "/people", label: session.isManagerPlus ? "Team" : "Directory", exact: true },
    { href: "/people/leave", label: "Leave" },
    ...(session.isManagerPlus ? [{ href: "/people/payroll", label: "Payroll" }] : []),
  ];
  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="People & HR"
        description={
          session.isPrincipal
            ? "The team, leave, visas and payroll. ID numbers and pay are encrypted and every view of them is logged."
            : session.isManagerPlus
              ? "The team, leave and visa dates. Pay and ID numbers are visible to principals only."
              : "Who's who at Lantana, and your own leave."
        }
        className="mb-4"
      />
      <SectionTabs items={tabs} label="People sections" />
      {children}
    </div>
  );
}
