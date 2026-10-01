"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { todayDubai } from "@/lib/dates";
import { addFxRateAction } from "@/server/actions/finance";

type Opt = { value: string; label: string };

export function FxForm({ currencies }: { currencies: Opt[] }) {
  const router = useRouter();
  const choices = currencies.filter((c) => c.value !== "AED");
  const [v, setV] = useState({ base: choices[0]?.value ?? "USD", rate_date: todayDubai(), rate: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addFxRateAction(v);
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            return void toast.error(r.error);
          }
          toast.success(`Saved: 1 ${v.base} = ${v.rate} AED on ${v.rate_date}`);
          setV({ ...v, rate: "" });
          setErrors({});
          router.refresh();
        });
      }}
    >
      <FormField label="Currency" htmlFor="fx-base" error={errors.base}>
        <NativeSelect id="fx-base" value={v.base} onChange={(e) => setV({ ...v, base: e.target.value })}>
          {choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Date" htmlFor="fx-date" error={errors.rate_date}>
        <Input id="fx-date" type="date" value={v.rate_date} onChange={(e) => setV({ ...v, rate_date: e.target.value })} />
      </FormField>
      <FormField label="AED per 1 unit" htmlFor="fx-rate" error={errors.rate}>
        <Input id="fx-rate" inputMode="decimal" value={v.rate} onChange={(e) => setV({ ...v, rate: e.target.value })} placeholder="e.g. 0.00142" />
      </FormField>
      <Button type="submit" disabled={pending}>
        Save rate
      </Button>
    </form>
  );
}
