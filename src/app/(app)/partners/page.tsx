import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { listContacts, listOrganizations } from "@/server/partners";
import { countryOptions, currencyOptions, peopleOptions } from "@/server/lookups";
import { listViews } from "@/server/actions/views";
import { PartnersView } from "@/components/partners/partners-view";

export const metadata: Metadata = { title: "Partners & Investors" };

export default async function PartnersPage() {
  const session = await getSession();
  const db = await createClient();
  const [orgs, contacts, countries, currencies, people, orgViews, contactViews] = await Promise.all([
    listOrganizations(db),
    listContacts(db),
    countryOptions(db),
    currencyOptions(db),
    peopleOptions(db),
    listViews("partners"),
    listViews("contacts"),
  ]);
  return (
    <Suspense>
      <PartnersView
        orgs={orgs}
        contacts={contacts}
        orgViews={orgViews}
        contactViews={contactViews}
        canEdit={session.isManagerPlus}
        options={{ countries, currencies, people }}
      />
    </Suspense>
  );
}
