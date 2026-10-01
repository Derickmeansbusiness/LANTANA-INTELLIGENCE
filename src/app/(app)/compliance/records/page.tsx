import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listRecords } from "@/server/compliance";
import { RecordsView } from "@/components/compliance/records-view";

export const metadata: Metadata = { title: "Corporate records · Compliance" };

export default async function RecordsPage() {
  const db = await createClient();
  const [rows, docs] = await Promise.all([listRecords(db), db.from("documents").select("id, title").is("deleted_at", null).order("title")]);
  return <RecordsView rows={rows} documents={(docs.data ?? []).map((d) => ({ value: d.id, label: d.title }))} />;
}
