"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileTextIcon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { daysBetween, fmtDate, todayDubai } from "@/lib/dates";
import { RECORD_KINDS } from "@/lib/schemas/compliance";
import { label } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";
import type { RecordRow } from "@/server/compliance";
import { saveRecordAction } from "@/server/actions/compliance";

type Opt = { value: string; label: string };
const KIND_TITLE: Record<string, string> = { licence: "Licences", registration: "Registrations", shareholder: "Shareholders", signatory: "Authorised signatories", lease: "Leases", other: "Other records" };

export function RecordsView({ rows, documents }: { rows: RecordRow[]; documents: Opt[] }) {
  const [editing, setEditing] = useState<RecordRow | "new" | null>(null);
  const today = todayDubai();
  const kinds = RECORD_KINDS.filter((k) => rows.some((r) => r.kind === k));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">The company’s standing facts: licences, registrations, shareholders, signatories and the registered lease. Expiry dates raise alerts.</p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <PlusIcon /> New record
        </Button>
      </div>
      {kinds.length === 0 && <p className="text-sm text-muted-foreground">No corporate records yet.</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        {kinds.map((k) => (
          <Card key={k}>
            <CardHeader>
              <CardTitle>{KIND_TITLE[k]}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {rows
                  .filter((r) => r.kind === k)
                  .map((r) => {
                    const days = r.expiry_date ? daysBetween(today, r.expiry_date) : null;
                    return (
                      <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                        <div className="min-w-0 text-sm">
                          <p className="font-medium">
                            {r.title}
                            {r.reference_no && <span className="num ml-2 font-normal text-muted-foreground">{r.reference_no}</span>}
                            {r.is_demo && <Badge variant="outline" className="ml-2 align-middle">Demo</Badge>}
                          </p>
                          {(r.detail || r.holder || r.authority) && (
                            <p className="text-muted-foreground">{[r.detail, r.holder, r.authority].filter(Boolean).join(" · ")}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {r.issue_date && <span className="num">Issued {fmtDate(r.issue_date)}</span>}
                            {r.expiry_date && (
                              <span className={cn("num", days != null && days <= 30 && "text-danger", days != null && days > 30 && days <= 90 && "text-warning")}>
                                {r.issue_date ? " · " : ""}Expires {fmtDate(r.expiry_date)} ({days! < 0 ? `${-days!} d ago` : `${days} d`})
                              </span>
                            )}
                          </p>
                          {r.document_id && (
                            <Link href={`/documents/${r.document_id}`} className="mt-1 inline-flex items-center gap-1 text-xs hover:text-gold-ink">
                              <FileTextIcon className="size-3" /> {r.document ?? "Document"}
                            </Link>
                          )}
                          {r.notes && <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>}
                        </div>
                        <Button variant="ghost" size="sm" aria-label={`Edit ${r.title}`} onClick={() => setEditing(r)}>
                          <PencilIcon />
                        </Button>
                      </li>
                    );
                  })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      {editing && <RecordDialog row={editing === "new" ? null : editing} documents={documents} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RecordDialog({ row, documents, onClose }: { row: RecordRow | null; documents: Opt[]; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    kind: row?.kind ?? "licence",
    title: row?.title ?? "",
    reference_no: row?.reference_no ?? "",
    authority: row?.authority ?? "",
    holder: row?.holder ?? "",
    detail: row?.detail ?? "",
    issue_date: row?.issue_date ?? "",
    expiry_date: row?.expiry_date ?? "",
    document_id: row?.document_id ?? "",
    notes: row?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const text = (k: keyof typeof v, lbl: string, type = "text", wide = false, hint?: string) => (
    <FormField label={lbl} htmlFor={`cr-${k}`} error={errors[k]} hint={hint} className={wide ? "sm:col-span-2" : undefined}>
      <Input id={`cr-${k}`} type={type} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </FormField>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle>{row ? "Edit record" : "New corporate record"}</DialogTitle>
        <DialogDescription className="mt-1">Keep the scanned original in the vault and link it here.</DialogDescription>
        <form
          noValidate
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveRecordAction(row?.id ?? null, v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success("Saved");
              onClose();
              router.refresh();
            });
          }}
        >
          <FormField label="Kind" htmlFor="cr-kind">
            <NativeSelect id="cr-kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
              {RECORD_KINDS.map((k) => (
                <option key={k} value={k}>
                  {label(k)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {text("reference_no", "Reference / number")}
          {text("title", "Title", "text", true)}
          {text("authority", "Issued by")}
          {text("holder", "Person or entity named", "text", false, "e.g. manager, shareholder")}
          {text("detail", "Detail", "text", true, "Licensed activity, shareholding %, scope of signing authority")}
          {text("issue_date", "Issued", "date")}
          {text("expiry_date", "Expires", "date")}
          <FormField label="Document in the vault" htmlFor="cr-doc" className="sm:col-span-2">
            <NativeSelect id="cr-doc" value={v.document_id} onChange={(e) => setV({ ...v, document_id: e.target.value })}>
              <option value="">None</option>
              {documents.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Notes" htmlFor="cr-notes" className="sm:col-span-2">
            <Textarea id="cr-notes" rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
