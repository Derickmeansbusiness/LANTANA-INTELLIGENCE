"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { ORG_TYPES, SECTORS, label } from "@/lib/schemas/common";
import { createOrganizationAction, updateOrganizationAction } from "@/server/actions/relationships";

type Opt = { value: string; label: string };

export type OrgFormValues = {
  name: string;
  type: string;
  country: string;
  regions_of_interest: string[];
  sectors: string[];
  ticket_min: string;
  ticket_max: string;
  ticket_currency: string;
  website: string;
  description: string;
  relationship_owner_id: string;
  status: string;
};

const EMPTY: OrgFormValues = {
  name: "",
  type: "",
  country: "",
  regions_of_interest: [],
  sectors: [],
  ticket_min: "",
  ticket_max: "",
  ticket_currency: "USD",
  website: "",
  description: "",
  relationship_owner_id: "",
  status: "active",
};

export function OrgFormDialog({
  open,
  onOpenChange,
  orgId,
  initial,
  options,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId?: string;
  initial?: Partial<OrgFormValues>;
  options: { countries: Opt[]; currencies: Opt[]; people: Opt[] };
}) {
  const router = useRouter();
  const [v, setV] = useState<OrgFormValues>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof OrgFormValues>(k: K, val: OrgFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const toggle = (k: "sectors" | "regions_of_interest", val: string) =>
    setV((s) => ({ ...s, [k]: s[k].includes(val) ? s[k].filter((x) => x !== val) : [...s[k], val] }));

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setErrors({}))}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{orgId ? "Edit organization" : "New organization"}</DialogTitle>
        <DialogDescription className="mt-1">Sectors, regions and ticket range feed the investor matcher on every deal.</DialogDescription>
        <form
          noValidate
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = orgId ? await updateOrganizationAction(orgId, v) : await createOrganizationAction(v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success(orgId ? "Organization updated" : "Organization added");
              onOpenChange(false);
              if (!orgId && r.data && typeof r.data === "object" && "id" in r.data) router.push(`/partners/${(r.data as { id: string }).id}`);
              else router.refresh();
            });
          }}
        >
          <FormField label="Name" htmlFor="org-name" error={errors.name} className="sm:col-span-2">
            <Input id="org-name" value={v.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} autoFocus maxLength={200} />
          </FormField>
          <FormField label="Type" htmlFor="org-type" error={errors.type}>
            <NativeSelect id="org-type" value={v.type} onChange={(e) => set("type", e.target.value)} aria-invalid={!!errors.type}>
              <option value="">Choose…</option>
              {ORG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Country" htmlFor="org-country">
            <NativeSelect id="org-country" value={v.country} onChange={(e) => set("country", e.target.value)}>
              <option value="">Multi-country / not set</option>
              {options.countries.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-xs font-medium text-muted-foreground">Sectors of interest</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {SECTORS.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <Checkbox checked={v.sectors.includes(s)} onCheckedChange={() => toggle("sectors", s)} /> {label(s)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-xs font-medium text-muted-foreground">Regions of interest</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {[
                ["africa", "Africa"],
                ["gcc", "GCC"],
                ["other", "Rest of world"],
              ].map(([k, l]) => (
                <label key={k} className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <Checkbox checked={v.regions_of_interest.includes(k)} onCheckedChange={() => toggle("regions_of_interest", k)} /> {l}
                </label>
              ))}
            </div>
          </fieldset>
          <FormField label="Ticket from" htmlFor="org-tmin" error={errors.ticket_min}>
            <Input id="org-tmin" inputMode="decimal" className="num" value={v.ticket_min} onChange={(e) => set("ticket_min", e.target.value)} placeholder="5,000,000" />
          </FormField>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <FormField label="Ticket to" htmlFor="org-tmax" error={errors.ticket_max}>
              <Input id="org-tmax" inputMode="decimal" className="num" value={v.ticket_max} onChange={(e) => set("ticket_max", e.target.value)} placeholder="50,000,000" />
            </FormField>
            <FormField label="Currency" htmlFor="org-tcur">
              <NativeSelect id="org-tcur" value={v.ticket_currency} onChange={(e) => set("ticket_currency", e.target.value)}>
                {options.currencies.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <FormField label="Relationship owner" htmlFor="org-owner">
            <NativeSelect id="org-owner" value={v.relationship_owner_id} onChange={(e) => set("relationship_owner_id", e.target.value)}>
              <option value="">Unassigned</option>
              {options.people.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Status" htmlFor="org-status">
            <NativeSelect id="org-status" value={v.status} onChange={(e) => set("status", e.target.value)}>
              {["prospect", "active", "dormant", "closed"].map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Website" htmlFor="org-web" error={errors.website} className="sm:col-span-2">
            <Input id="org-web" type="url" value={v.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
          </FormField>
          <FormField label="Description" htmlFor="org-desc" className="sm:col-span-2">
            <Textarea id="org-desc" value={v.description} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={4000} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {orgId ? "Save" : "Add organization"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
