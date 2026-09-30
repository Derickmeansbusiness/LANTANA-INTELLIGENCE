import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { forecastByMonth, listDeals } from "@/server/deals";
import { countryOptions, currencyOptions, orgOptions, peopleOptions, stageOptions } from "@/server/lookups";
import { listViews } from "@/server/actions/views";
import { DealsView } from "@/components/deals/deals-view";

export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage() {
  const session = await getSession();
  const db = await createClient();
  const [deals, stages, people, orgs, countries, currencies, views] = await Promise.all([
    listDeals(db),
    stageOptions(db),
    peopleOptions(db),
    orgOptions(db),
    countryOptions(db),
    currencyOptions(db),
    listViews("deals"),
  ]);
  return (
    <Suspense>
      <DealsView
        deals={deals}
        options={{ stages, people, orgs, countries, currencies }}
        views={views}
        forecast={forecastByMonth(deals)}
        canCreate={session.isManagerPlus}
        userId={session.userId}
        isStaff={session.role === "staff"}
      />
    </Suspense>
  );
}
