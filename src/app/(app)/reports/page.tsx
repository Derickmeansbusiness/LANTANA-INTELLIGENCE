import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { listReportsPage, nextScheduleDate } from "@/server/reports";
import { PageHeader } from "@/components/page-header";
import { ReportsHome } from "@/components/reports/reports-home";

export const metadata: Metadata = { title: "Reports" };

/** Reports are management-only; staff get the same not-found as a hidden record. */
export default async function ReportsPage() {
  const session = await getSession();
  if (!session.isManagerPlus) notFound();
  const db = await createClient();
  const d = await listReportsPage(db);
  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Reports"
        description="Packs on the letterhead, built from live records under your own access. Save a copy to the vault or download the PDF."
      />
      <ReportsHome
        reports={d.reports}
        schedules={d.schedules.map((s) => ({ ...s, next: nextScheduleDate(s.cadence) }))}
        runs={d.runs}
        people={d.recipients}
        userId={session.userId}
        isPrincipal={session.isPrincipal}
      />
    </div>
  );
}
