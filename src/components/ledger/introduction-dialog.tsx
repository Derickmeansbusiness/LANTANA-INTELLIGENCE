"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { INTRO_CHANNELS, label } from "@/lib/schemas/common";
import { todayDubai } from "@/lib/dates";
import { logIntroductionAction } from "@/server/actions/deals";

type Opt = { value: string; label: string };

export function IntroductionDialog({
  open,
  onOpenChange,
  orgs,
  contacts,
  deals,
  dealId,
  corrects,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgs: Opt[];
  contacts: (Opt & { orgId: string | null })[];
  deals: Opt[];
  dealId?: string;
  /** When set, this entry corrects an earlier one (the original stays untouched). */
  corrects?: { id: string; seq: number; summary: string };
}) {
  const router = useRouter();
  const blank = { introduced_on: todayDubai(), deal_id: dealId ?? "", party_a_org_id: "", party_a_contact_id: "", party_b_org_id: "", party_b_contact_id: "", channel: "email", summary: "" };
  const [v, setV] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setErrors({}))}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{corrects ? `Correct entry #${corrects.seq}` : "Log an introduction"}</DialogTitle>
        <DialogDescription className="mt-1 flex items-start gap-1.5">
          <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-gold" />
          <span>
            Entries are permanent and hash-chained: they can&apos;t be edited or deleted, only corrected by a later entry. Record what happened, when, and how, as you&apos;d want it read in a dispute.
          </span>
        </DialogDescription>
        {corrects && <p className="mt-3 rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">Original: {corrects.summary}</p>}
        <form
          noValidate
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await logIntroductionAction({ ...v, corrects_id: corrects?.id ?? "" });
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success(`Logged as entry #${r.data.seq}`);
              setV(blank);
              onOpenChange(false);
              router.refresh();
            });
          }}
        >
          <FormField label="Date of introduction" htmlFor="in-date" error={errors.introduced_on}>
            <Input id="in-date" type="date" max={todayDubai()} value={v.introduced_on} onChange={(e) => set("introduced_on", e.target.value)} className="num" />
          </FormField>
          <FormField label="Channel" htmlFor="in-channel">
            <NativeSelect id="in-channel" value={v.channel} onChange={(e) => set("channel", e.target.value)}>
              {INTRO_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {(["a", "b"] as const).map((side) => {
            const orgKey = `party_${side}_org_id` as const;
            const contactKey = `party_${side}_contact_id` as const;
            return (
              <div key={side} className="grid gap-3 rounded-md border p-3">
                <FormField label={`Party ${side.toUpperCase()}`} htmlFor={`in-${side}-org`} error={errors[orgKey]}>
                  <NativeSelect id={`in-${side}-org`} value={v[orgKey]} onChange={(e) => (set(orgKey, e.target.value), set(contactKey, ""))} aria-invalid={!!errors[orgKey]}>
                    <option value="">Choose an organization…</option>
                    {orgs.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField label="Contact person" htmlFor={`in-${side}-contact`}>
                  <NativeSelect id={`in-${side}-contact`} value={v[contactKey]} onChange={(e) => set(contactKey, e.target.value)}>
                    <option value="">Not specified</option>
                    {contacts
                      .filter((c) => c.orgId === v[orgKey])
                      .map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                  </NativeSelect>
                </FormField>
              </div>
            );
          })}
          {!dealId && (
            <FormField label="Deal" htmlFor="in-deal" className="sm:col-span-2">
              <NativeSelect id="in-deal" value={v.deal_id} onChange={(e) => set("deal_id", e.target.value)}>
                <option value="">Not tied to a deal</option>
                {deals.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="What was introduced, and how" htmlFor="in-summary" error={errors.summary} className="sm:col-span-2" hint="e.g. Sent teaser and NCNDA to Faminas by email, copying PJM Advisory.">
            <Textarea id="in-summary" value={v.summary} onChange={(e) => set("summary", e.target.value)} rows={3} maxLength={2000} aria-invalid={!!errors.summary} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Record permanently
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
