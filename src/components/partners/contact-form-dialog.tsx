"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { createContactAction, updateContactAction } from "@/server/actions/relationships";

type Opt = { value: string; label: string };
export type ContactFormValues = { organization_id: string; full_name: string; job_title: string; email: string; phone: string; country: string; notes: string };

export function ContactFormDialog({
  open,
  onOpenChange,
  contactId,
  initial,
  orgs,
  countries,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contactId?: string;
  initial?: Partial<ContactFormValues>;
  orgs: Opt[];
  countries: Opt[];
}) {
  const router = useRouter();
  const blank: ContactFormValues = { organization_id: "", full_name: "", job_title: "", email: "", phone: "", country: "", notes: "" };
  const [v, setV] = useState<ContactFormValues>({ ...blank, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof ContactFormValues, val: string) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setErrors({}))}>
      <DialogContent className="max-w-lg">
        <DialogTitle>{contactId ? "Edit contact" : "New contact"}</DialogTitle>
        <form
          noValidate
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = contactId ? await updateContactAction(contactId, v) : await createContactAction(v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success(contactId ? "Contact updated" : "Contact added");
              onOpenChange(false);
              if (!contactId) setV({ ...blank, ...initial });
              router.refresh();
            });
          }}
        >
          <FormField label="Full name" htmlFor="ct-name" error={errors.full_name} className="sm:col-span-2">
            <Input id="ct-name" value={v.full_name} onChange={(e) => set("full_name", e.target.value)} autoFocus maxLength={160} aria-invalid={!!errors.full_name} />
          </FormField>
          <FormField label="Organization" htmlFor="ct-org" className="sm:col-span-2">
            <NativeSelect id="ct-org" value={v.organization_id} onChange={(e) => set("organization_id", e.target.value)}>
              <option value="">Independent</option>
              {orgs.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Role / title" htmlFor="ct-title">
            <Input id="ct-title" value={v.job_title} onChange={(e) => set("job_title", e.target.value)} maxLength={160} />
          </FormField>
          <FormField label="Country" htmlFor="ct-country">
            <NativeSelect id="ct-country" value={v.country} onChange={(e) => set("country", e.target.value)}>
              <option value="">Not set</option>
              {countries.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Email" htmlFor="ct-email" error={errors.email}>
            <Input id="ct-email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} />
          </FormField>
          <FormField label="Phone / WhatsApp" htmlFor="ct-phone">
            <Input id="ct-phone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+255 …" maxLength={40} />
          </FormField>
          <FormField label="Notes" htmlFor="ct-notes" className="sm:col-span-2">
            <Textarea id="ct-notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} rows={2} maxLength={2000} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {contactId ? "Save" : "Add contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
