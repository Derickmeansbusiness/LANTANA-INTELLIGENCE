"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { INTERACTION_KINDS, label } from "@/lib/schemas/common";
import { todayDubai } from "@/lib/dates";
import { logInteractionAction } from "@/server/actions/relationships";

type Opt = { value: string; label: string };

export function InteractionDialog({
  open,
  onOpenChange,
  organizationId,
  dealId,
  orgs,
  contacts,
  deals,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  organizationId?: string;
  dealId?: string;
  orgs?: Opt[];
  contacts: (Opt & { orgId: string | null })[];
  deals?: Opt[];
}) {
  const [v, setV] = useState({ organization_id: organizationId ?? "", contact_id: "", deal_id: dealId ?? "", kind: "call", occurred_on: todayDubai(), summary: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));
  const orgContacts = contacts.filter((c) => !v.organization_id || c.orgId === v.organization_id);

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setErrors({}))}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Log an interaction</DialogTitle>
        <DialogDescription className="mt-1">Calls, meetings, emails and visits build the relationship timeline and update last contact.</DialogDescription>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await logInteractionAction(v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success("Interaction logged");
              setV((s) => ({ ...s, summary: "", contact_id: "" }));
              onOpenChange(false);
            });
          }}
        >
          {orgs && !organizationId && (
            <FormField label="Organization" htmlFor="ix-org" error={errors.organization_id} className="sm:col-span-2">
              <NativeSelect id="ix-org" value={v.organization_id} onChange={(e) => (set("organization_id", e.target.value), set("contact_id", ""))}>
                <option value="">None</option>
                {orgs.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="Type" htmlFor="ix-kind">
            <NativeSelect id="ix-kind" value={v.kind} onChange={(e) => set("kind", e.target.value)}>
              {INTERACTION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {label(k)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Date" htmlFor="ix-date" error={errors.occurred_on}>
            <Input id="ix-date" type="date" value={v.occurred_on} max={todayDubai()} onChange={(e) => set("occurred_on", e.target.value)} className="num" />
          </FormField>
          <FormField label="With" htmlFor="ix-contact">
            <NativeSelect id="ix-contact" value={v.contact_id} onChange={(e) => set("contact_id", e.target.value)}>
              <option value="">No specific contact</option>
              {orgContacts.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {deals && !dealId && (
            <FormField label="Deal" htmlFor="ix-deal">
              <NativeSelect id="ix-deal" value={v.deal_id} onChange={(e) => set("deal_id", e.target.value)}>
                <option value="">Not about a specific deal</option>
                {deals.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="What happened" htmlFor="ix-summary" error={errors.summary} className="sm:col-span-2">
            <Textarea id="ix-summary" value={v.summary} onChange={(e) => set("summary", e.target.value)} rows={3} required maxLength={5000} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !v.summary.trim()}>
              {pending && <Loader2Icon className="animate-spin" />}
              Log it
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
