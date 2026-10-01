import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { listObligations } from "@/server/compliance";
import { peopleOptions } from "@/server/lookups";
import { ObligationsView } from "@/components/compliance/obligations-view";

export const metadata: Metadata = { title: "Compliance" };

export default async function CompliancePage() {
  const session = await getSession();
  const db = await createClient();
  const [rows, people, docs] = await Promise.all([
    listObligations(db),
    peopleOptions(db),
    db.from("documents").select("id, title").is("deleted_at", null).order("title"),
  ]);
  return <ObligationsView rows={rows} principal={session.isPrincipal} people={people} documents={(docs.data ?? []).map((d) => ({ value: d.id, label: d.title }))} />;
}
