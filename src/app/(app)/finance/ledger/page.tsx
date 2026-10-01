import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { bankAccountOptions, listAccounts, listRules, listTransactions } from "@/server/finance";
import { currencyOptions, orgOptions } from "@/server/lookups";
import { listViews } from "@/server/actions/views";
import { LedgerView } from "@/components/finance/ledger-view";

export const metadata: Metadata = { title: "Ledger · Finance" };

export default async function LedgerPage() {
  const session = await getSession();
  const db = await createClient();
  const [rows, views, accounts, banks, currencies, orgs, rules] = await Promise.all([
    listTransactions(db),
    listViews("finance_ledger"),
    listAccounts(db),
    bankAccountOptions(db),
    currencyOptions(db),
    orgOptions(db),
    listRules(db),
  ]);
  return <LedgerView rows={rows} views={views} rules={rules} principal={session.isPrincipal} options={{ accounts, banks, currencies, orgs }} />;
}
