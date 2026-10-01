import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/dates";
import { listFxRates } from "@/server/finance";
import { currencyOptions } from "@/server/lookups";
import { FxForm } from "@/components/finance/fx-form";

export const metadata: Metadata = { title: "FX rates · Finance" };

export default async function FxPage() {
  const db = await createClient();
  const [rates, currencies] = await Promise.all([listFxRates(db), currencyOptions(db)]);
  const latest = new Map<string, (typeof rates)[number]>();
  for (const r of rates) if (!latest.has(r.base)) latest.set(r.base, r);
  const missing = currencies.filter((c) => c.value !== "AED" && !latest.has(c.value));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <div>
            <CardTitle>Rates against AED</CardTitle>
            <CardDescription>
              Every amount is converted at the latest rate on or before its own date. USD (3.6725) and SAR are pegged and already set. Add the others (EUR, XAF, TZS, NGN…) as you need them; XAF is fixed at 655.957 per EUR.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <FxForm currencies={currencies} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th scope="col" className="py-2 text-left font-normal">Currency</th>
                  <th scope="col" className="py-2 text-right font-normal">AED per unit</th>
                  <th scope="col" className="py-2 text-right font-normal">As of</th>
                  <th scope="col" className="py-2 pl-3 text-left font-normal">Source</th>
                </tr>
              </thead>
              <tbody>
                {[...latest.values()].map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-1.5 font-medium">{r.base}</td>
                    <td className="num py-1.5 text-right">{Number(r.rate).toLocaleString("en-US", { maximumFractionDigits: 8 })}</td>
                    <td className="num py-1.5 text-right">{fmtDate(r.rate_date)}</td>
                    <td className="py-1.5 pl-3">
                      <Badge variant={r.source === "peg" ? "info" : "outline"}>{r.source === "peg" ? "Peg" : r.is_demo ? "Demo" : "Manual"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Missing rates</CardTitle>
            <CardDescription>Amounts in these currencies are left out of AED totals until a rate exists.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every currency has a rate.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {missing.map((c) => (
                <li key={c.value}>
                  <Badge variant="warning">{c.label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
