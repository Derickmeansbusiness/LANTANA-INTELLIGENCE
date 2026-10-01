"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUpIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { ColumnMap } from "@/lib/finance";
import type { ImportPreview } from "@/server/finance";
import { commitImportAction, previewImportAction } from "@/server/actions/finance";

type Opt = { value: string; label: string };

/**
 * Bank statement import: upload a CSV → we read it and suggest a category per
 * line (rules first, then similar past lines) → a person checks every
 * suggestion → import. Lines already imported are skipped.
 */
export function ImportDialog({
  open,
  onOpenChange,
  options,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  options: { accounts: Opt[]; banks: (Opt & { currency: string })[]; currencies: Opt[] };
}) {
  const router = useRouter();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [bank, setBank] = useState(options.banks[0]?.value ?? "");
  const [currency, setCurrency] = useState(options.banks[0]?.currency ?? "AED");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [cats, setCats] = useState<Record<number, string>>({});
  const [skip, setSkip] = useState<Record<number, boolean>>({});
  const [pending, start] = useTransition();

  const reset = () => {
    setFile(null);
    setPreview(null);
    setMap(null);
    setCats({});
    setSkip({});
  };

  const read = (m: ColumnMap | null, f = file, b = bank, c = currency) =>
    f &&
    start(async () => {
      const r = await previewImportAction({ csv: f.text, bank_account_id: b || null, currency: c, map: m });
      if (!r.ok) return void toast.error(r.error);
      setPreview(r.data);
      setMap(r.data.map);
      setCats(Object.fromEntries(r.data.lines.map((l, i) => [i, l.account_id ?? ""])));
      setSkip(Object.fromEntries(r.data.lines.map((l, i) => [i, l.duplicate])));
    });

  const counts = useMemo(() => {
    if (!preview) return null;
    const keep = preview.lines.filter((_, i) => !skip[i]);
    return {
      keep: keep.length,
      dupes: preview.lines.filter((l) => l.duplicate).length,
      uncategorised: preview.lines.filter((_, i) => !skip[i] && !cats[i]).length,
      net: keep.reduce((s, l) => s + l.amount, 0),
    };
  }, [preview, skip, cats]);

  const commit = () =>
    preview &&
    file &&
    start(async () => {
      const lines = preview.lines
        .map((l, i) => ({ l, i }))
        .filter(({ i }) => !skip[i])
        .map(({ l, i }) => ({
          date: l.date,
          description: l.description,
          amount: l.amount,
          reference: l.reference,
          account_id: cats[i] || null,
          // Keep the suggestion's source only when the person left it as suggested.
          source: cats[i] && cats[i] === (l.account_id ?? "") ? l.source : "manual",
          key: l.key,
        }));
      const r = await commitImportAction({ file_name: file.name, bank_account_id: bank || null, currency, lines });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Imported ${r.data.imported} line${r.data.imported === 1 ? "" : "s"}${r.data.skipped ? `, ${r.data.skipped} already there` : ""}`);
      reset();
      onOpenChange(false);
      router.refresh();
    });

  const colSelect = (k: keyof ColumnMap, lbl: string, optional = false) =>
    preview && map ? (
      <FormField label={lbl} htmlFor={`map-${k}`}>
        <NativeSelect
          id={`map-${k}`}
          value={map[k] == null ? "" : String(map[k])}
          onChange={(e) => {
            const next = { ...map, [k]: e.target.value === "" ? null : Number(e.target.value) } as ColumnMap;
            setMap(next);
            read(next);
          }}
        >
          {optional && <option value="">None</option>}
          {preview.header.map((h, i) => (
            <option key={i} value={i}>
              {h || `Column ${i + 1}`}
            </option>
          ))}
        </NativeSelect>
      </FormField>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && reset())}>
      <DialogContent className="top-[3vh] max-h-[94vh] max-w-5xl overflow-y-auto">
        <DialogTitle>Import a bank statement</DialogTitle>
        <DialogDescription className="mt-1">
          CSV from any bank. Day-first dates (03/04/2026 = 3 April) and debit/credit or signed amount columns are understood. Every suggested category is yours to change.
        </DialogDescription>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <FormField label="Statement file (.csv)" htmlFor="imp-file" className="sm:col-span-1">
            <label
              htmlFor="imp-file"
              className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 text-sm text-muted-foreground hover:border-gold hover:text-foreground"
            >
              <FileUpIcon className="size-4" /> <span className="truncate">{file?.name ?? "Choose a file"}</span>
            </label>
            <input
              id="imp-file"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2_000_000) return void toast.error("That file is over 2 MB. Split the statement.");
                const next = { name: f.name, text: await f.text() };
                setFile(next);
                read(null, next);
              }}
            />
          </FormField>
          {options.banks.length > 0 && (
            <FormField label="Bank account" htmlFor="imp-bank">
              <NativeSelect
                id="imp-bank"
                value={bank}
                onChange={(e) => {
                  setBank(e.target.value);
                  const b = options.banks.find((x) => x.value === e.target.value);
                  if (b) setCurrency(b.currency);
                  read(map, file, e.target.value, b?.currency ?? currency);
                }}
              >
                <option value="">None (ledger only)</option>
                {options.banks.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="Currency" htmlFor="imp-cur">
            <NativeSelect
              id="imp-cur"
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                read(map, file, bank, e.target.value);
              }}
            >
              {options.currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>

        {pending && !preview && (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" /> Reading the statement…
          </p>
        )}

        {preview && counts && (
          <>
            <div className="mt-5 grid gap-3 rounded-md border p-3 sm:grid-cols-5">
              {colSelect("date", "Date column")}
              {colSelect("description", "Description column")}
              {map?.amount != null ? colSelect("amount", "Amount column") : (
                <>
                  {colSelect("debit", "Money out column")}
                  {colSelect("credit", "Money in column")}
                </>
              )}
              {colSelect("reference", "Reference column", true)}
            </div>

            <p className="mt-4 text-sm">
              <span className="num font-medium">{counts.keep}</span> to import · net <span className="num">{formatMoney(counts.net, currency)}</span>
              {counts.dupes > 0 && <span className="text-muted-foreground"> · {counts.dupes} already imported (skipped)</span>}
              {counts.uncategorised > 0 && <span className="text-warning"> · {counts.uncategorised} without a category</span>}
              {preview.problems.length > 0 && <span className="text-danger"> · {preview.problems.length} row(s) unreadable</span>}
            </p>
            {preview.problems.length > 0 && (
              <ul className="mt-1 text-xs text-danger">
                {preview.problems.slice(0, 5).map((p) => (
                  <li key={p.row}>
                    Row {p.row}: {p.problem}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 max-h-[46vh] overflow-auto rounded-md border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-surface text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="w-8 p-2" scope="col">
                      <span className="sr-only">Include</span>
                    </th>
                    <th className="p-2 text-left font-normal" scope="col">Date</th>
                    <th className="p-2 text-left font-normal" scope="col">Description</th>
                    <th className="p-2 text-right font-normal" scope="col">Amount</th>
                    <th className="p-2 text-left font-normal" scope="col">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((l, i) => (
                    <tr key={l.key} className={`border-b last:border-0 ${skip[i] ? "opacity-50" : ""}`}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          aria-label={`Import row ${l.row}`}
                          checked={!skip[i]}
                          onChange={(e) => setSkip((s) => ({ ...s, [i]: !e.target.checked }))}
                          className="size-4 accent-[var(--brand-gold)]"
                        />
                      </td>
                      <td className="num p-2 whitespace-nowrap">{fmtDate(l.date)}</td>
                      <td className="p-2">
                        <div className="max-w-[22rem] truncate" title={l.description}>
                          {l.description}
                        </div>
                        {l.duplicate && <Badge variant="outline">Already imported</Badge>}
                      </td>
                      <td className={`num p-2 text-right whitespace-nowrap ${l.amount < 0 ? "" : "text-success"}`}>{formatMoney(l.amount, currency)}</td>
                      <td className="p-2">
                        <NativeSelect
                          aria-label={`Category for row ${l.row}`}
                          value={cats[i] ?? ""}
                          onChange={(e) => setCats((c) => ({ ...c, [i]: e.target.value }))}
                          className="h-8 min-w-48"
                        >
                          <option value="">Not categorised</option>
                          {options.accounts.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.label}
                            </option>
                          ))}
                        </NativeSelect>
                        {l.reason && cats[i] === l.account_id && <p className="mt-0.5 text-[11px] text-muted-foreground">Suggested: {l.reason}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={commit} disabled={pending || !preview || !counts?.keep}>
            {pending && preview ? <Loader2Icon className="animate-spin" /> : null} Import {counts?.keep ? counts.keep : ""} line{counts?.keep === 1 ? "" : "s"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
