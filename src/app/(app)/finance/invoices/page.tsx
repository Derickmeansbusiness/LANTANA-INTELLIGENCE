import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listInvoices } from "@/server/finance";
import { currencyOptions, dealOptions, orgOptions } from "@/server/lookups";
import { listViews } from "@/server/actions/views";
import { InvoicesView } from "@/components/finance/invoices-view";

export const metadata: Metadata = { title: "Invoices · Finance" };

export default async function InvoicesPage() {
  const db = await createClient();
  const [rows, views, orgs, deals, currencies] = await Promise.all([listInvoices(db), listViews("invoices"), orgOptions(db), dealOptions(db), currencyOptions(db)]);
  return <InvoicesView rows={rows} views={views} options={{ orgs, deals, currencies }} />;
}
