import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, todayDubai } from "@/lib/dates";
import { formatMoney, toMajor } from "@/lib/money";
import { label } from "@/lib/schemas/common";
import { agingBucket } from "@/lib/finance";
import { bankAccountOptions, getInvoice, listAccounts } from "@/server/finance";
import { currencyOptions, dealOptions, orgOptions } from "@/server/lookups";
import { InvoiceActions, InvoiceLines } from "@/components/finance/invoice-panels";
import { agingLabel, invoiceStatusVariant } from "@/components/finance/format";

export async function generateMetadata({ params }: PageProps<"/finance/invoices/[id]">): Promise<Metadata> {
  const { id } = await params;
  const db = await createClient();
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await db.from("invoices").select("invoice_no").eq("id", id).maybeSingle() : { data: null };
  return { title: data ? `Invoice ${data.invoice_no}` : "Invoice" };
}

export default async function InvoicePage({ params }: PageProps<"/finance/invoices/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const inv = await getInvoice(db, id);
  if (!inv) notFound();
  const [orgs, deals, currencies, accounts, banks] = await Promise.all([orgOptions(db), dealOptions(db), currencyOptions(db), listAccounts(db), bankAccountOptions(db)]);
  const aging = inv.status === "sent" ? agingBucket(inv.due_date, todayDubai()) : null;
  const m = (minor: number) => formatMoney(toMajor(minor, inv.currency), inv.currency);

  return (
    <div>
      <Link href="/finance/invoices" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-3.5" /> Invoices
      </Link>
      <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="num font-display text-2xl">{inv.invoice_no}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={invoiceStatusVariant(inv.status, aging)}>{label(inv.status)}</Badge>
            {aging && aging !== "current" && <span className="text-danger">{agingLabel(aging)}</span>}
            {inv.is_demo && <Badge variant="outline">Demo</Badge>}
            <span>{inv.org?.name ?? "No client"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <InvoiceActions
            id={inv.id}
            status={inv.status}
            initial={{
              organization_id: inv.organization_id ?? "",
              deal_id: inv.deal_id ?? "",
              kind: inv.kind,
              issue_date: inv.issue_date,
              due_date: inv.due_date,
              currency: inv.currency,
              vat_rate: String(Number(inv.vat_rate)),
              reference: inv.reference ?? "",
              notes: inv.notes ?? "",
            }}
            options={{ orgs, deals, currencies, incomeAccounts: accounts.filter((a) => a.type === "income"), banks }}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lines</CardTitle>
          </CardHeader>
          <CardContent>
            <InvoiceLines
              invoiceId={inv.id}
              currency={inv.currency}
              lines={inv.items}
              editable={inv.status === "draft"}
              totals={{ subtotal: inv.subtotal_minor, vatRate: Number(inv.vat_rate), vat: inv.vat_minor, total: inv.total_minor }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Bill to</dt>
              <dd>
                {inv.org ? (
                  <Link href={`/partners/${inv.org.id}`} className="hover:text-gold-ink">
                    {inv.org.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">Deal</dt>
              <dd>{inv.deal ? <Link href={`/deals/${inv.deal.id}`} className="hover:text-gold-ink">{inv.deal.name}</Link> : "—"}</dd>
              <dt className="text-muted-foreground">Kind</dt>
              <dd>{label(inv.kind)}</dd>
              <dt className="text-muted-foreground">Issued</dt>
              <dd className="num">{fmtDate(inv.issue_date)}</dd>
              <dt className="text-muted-foreground">Due</dt>
              <dd className="num">{fmtDate(inv.due_date)}</dd>
              <dt className="text-muted-foreground">Client ref.</dt>
              <dd>{inv.reference ?? "—"}</dd>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="num font-medium">{m(inv.total_minor)}</dd>
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="num">{inv.paid_at ? fmtDate(inv.paid_at) : "—"}</dd>
            </dl>
            {inv.notes && <p className="mt-4 rounded-md bg-surface-2 p-3 text-sm whitespace-pre-wrap">{inv.notes}</p>}
            {inv.payments.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground">Receipts in the ledger</p>
                <ul className="mt-1 text-sm">
                  {inv.payments.map((p) => (
                    <li key={p.id} className="num">
                      {fmtDate(p.txn_date)} · {formatMoney(toMajor(p.amount_minor, p.currency), p.currency)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">Bank details are never printed on invoices. Confirm them to the client separately.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
