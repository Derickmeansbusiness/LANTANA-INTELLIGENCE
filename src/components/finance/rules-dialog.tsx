"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { addRuleAction, archiveRuleAction } from "@/server/actions/finance";

type Opt = { value: string; label: string };
export type Rule = { id: string; pattern: string; account_id: string; is_demo: boolean; account: { code: string; name: string } | null };

export function RulesDialog({ open, onOpenChange, rules, accounts }: { open: boolean; onOpenChange: (o: boolean) => void; rules: Rule[]; accounts: Opt[] }) {
  const router = useRouter();
  const [v, setV] = useState({ pattern: "", account_id: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle>Category rules</DialogTitle>
        <DialogDescription className="mt-1">
          When a description contains the text, that category is suggested on import. The longest match wins. Without a rule, the most similar past line is suggested.
        </DialogDescription>
        <form
          noValidate
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addRuleAction(v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              setV({ pattern: "", account_id: "" });
              setErrors({});
              router.refresh();
            });
          }}
        >
          <FormField label="Description contains" htmlFor="rule-pat" error={errors.pattern} className="min-w-40 flex-1">
            <Input id="rule-pat" value={v.pattern} onChange={(e) => setV({ ...v, pattern: e.target.value })} placeholder="e.g. flydubai" />
          </FormField>
          <FormField label="Category" htmlFor="rule-acc" error={errors.account_id} className="min-w-48 flex-1">
            <NativeSelect id="rule-acc" value={v.account_id} onChange={(e) => setV({ ...v, account_id: e.target.value })}>
              <option value="">Choose…</option>
              {accounts.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <Button type="submit" variant="outline" disabled={pending}>
            Add rule
          </Button>
        </form>
        <ul className="mt-4 divide-y rounded-md border">
          {rules.length === 0 && <li className="p-3 text-sm text-muted-foreground">No rules yet.</li>}
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium">“{r.pattern}”</span> → {r.account ? `${r.account.code} · ${r.account.name}` : "—"}
                {r.is_demo && <Badge variant="outline" className="ml-2">Demo</Badge>}
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove rule ${r.pattern}`}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await archiveRuleAction(r.id);
                    if (!res.ok) return void toast.error(res.error);
                    router.refresh();
                  })
                }
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
