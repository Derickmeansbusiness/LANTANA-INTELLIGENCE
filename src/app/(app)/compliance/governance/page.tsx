import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listGovernance } from "@/server/compliance";
import { peopleOptions } from "@/server/lookups";
import { GovernanceView } from "@/components/compliance/governance-view";

export const metadata: Metadata = { title: "Meetings & resolutions · Compliance" };

export default async function GovernancePage() {
  const db = await createClient();
  const [{ meetings, written }, people] = await Promise.all([listGovernance(db), peopleOptions(db)]);
  return <GovernanceView meetings={meetings} written={written} people={people} />;
}
