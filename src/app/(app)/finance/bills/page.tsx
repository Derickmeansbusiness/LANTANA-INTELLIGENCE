import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { bankAccountOptions, listAccounts, listBills } from "@/server/finance";
import { currencyOptions, orgOptions } from "@/server/lookups";
import { listViews } from "@/server/actions/views";
import { BillsView } from "@/components/finance/bills-view";

export const metadata: Metadata = { title: "Bills · Finance" };

export default async function BillsPage() {
  const db = await createClient();
  const [rows, views, orgs, accounts, currencies, banks] = await Promise.all([
    listBills(db),
    listViews("bills"),
    orgOptions(db),
    listAccounts(db),
    currencyOptions(db),
    bankAccountOptions(db),
  ]);
  return <BillsView rows={rows} views={views} options={{ orgs, expenseAccounts: accounts.filter((a) => a.type === "expense"), currencies, banks }} />;
}
