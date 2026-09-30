import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { listContracts } from "@/server/contracts";
import { orgOptions, peopleOptions } from "@/server/lookups";
import { listViews } from "@/server/actions/views";
import { ContractsView } from "@/components/contracts/contracts-view";

export const metadata: Metadata = { title: "Contracts" };

export default async function ContractsPage() {
  const session = await getSession();
  // The register is management-only (RLS); staff get the same not-found as a hidden record.
  if (!session.isManagerPlus) notFound();
  const db = await createClient();
  const [rows, views, orgs, people, docs] = await Promise.all([
    listContracts(db),
    listViews("contracts"),
    orgOptions(db),
    peopleOptions(db),
    db.from("documents").select("id, title").is("deleted_at", null).in("doc_type", ["agreement", "lease", "letter"]).order("title"),
  ]);
  return <ContractsView rows={rows} views={views} options={{ orgs, people, documents: (docs.data ?? []).map((d) => ({ value: d.id, label: d.title })) }} />;
}
