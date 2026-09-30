import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { chainStatus, listIntroductions } from "@/server/ledger";
import { contactOptions, orgOptions } from "@/server/lookups";
import { listViews } from "@/server/actions/views";
import { LedgerView } from "@/components/ledger/ledger-view";

export const metadata: Metadata = { title: "Introductions ledger" };

export default async function LedgerPage({ searchParams }: PageProps<"/deals/ledger">) {
  const sp = await searchParams;
  const dealId = typeof sp.deal === "string" && /^[0-9a-f-]{36}$/i.test(sp.deal) ? sp.deal : undefined;
  const session = await getSession();
  const db = await createClient();
  const [rows, chain, orgs, contacts, deals, views, deal] = await Promise.all([
    listIntroductions(db, { dealId }),
    session.isManagerPlus ? chainStatus(db) : Promise.resolve(null),
    orgOptions(db),
    contactOptions(db),
    db.from("deals").select("id, name").is("deleted_at", null).order("name"),
    listViews("ledger"),
    dealId ? db.from("deals").select("id, name").eq("id", dealId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <LedgerView
      rows={rows}
      views={views}
      chain={chain}
      deal={deal.data}
      canLog={session.isManagerPlus}
      options={{ orgs, contacts, deals: (deals.data ?? []).map((d) => ({ value: d.id, label: d.name })) }}
    />
  );
}
