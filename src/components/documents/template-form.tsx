"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDownIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import type { Field } from "@/lib/templates/types";
import { cn } from "@/lib/utils";
import { generateFromTemplateAction } from "@/server/actions/documents";
import type { LinkTarget } from "@/server/documents";
import { LinkPicker, type DocMeta } from "./meta-fields";

export function TemplateForm({ templateId, fields, targets }: { templateId: string; fields: Field[]; targets: LinkTarget[] }) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, f.default ?? ""])));
  const [format, setFormat] = useState<"pdf" | "docx">("pdf");
  const [draft, setDraft] = useState(true);
  const [links, setLinks] = useState<DocMeta["links"]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const hasCounterparty = fields.some((f) => f.name === "cp_name");
  const orgs = targets.filter((t) => t.entity_type === "organization");

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await generateFromTemplateAction({ templateId, values: v, format, draft, links });
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            return void toast.error(r.error);
          }
          toast.success("Saved to the vault as a draft.");
          router.push(`/documents/${r.data.id}`);
        });
      }}
    >
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          {hasCounterparty && orgs.length > 0 && (
            <FormField label="Fill from the directory" htmlFor="tpl-org" className="sm:col-span-2" hint="Copies the name; check jurisdiction and address against their documents.">
              <NativeSelect
                id="tpl-org"
                value=""
                onChange={(e) => {
                  const org = orgs.find((o) => o.entity_id === e.target.value);
                  if (!org) return;
                  setV((s) => ({ ...s, cp_name: org.name }));
                  setLinks((l) => (l.some((x) => x.entity_id === org.entity_id) ? l : [...l, { entity_type: "organization", entity_id: org.entity_id }]));
                }}
              >
                <option value="">Choose an organization…</option>
                {orgs.map((o) => (
                  <option key={o.entity_id} value={o.entity_id}>
                    {o.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          {fields.map((f) => {
            const id = `tpl-${f.name}`;
            const common = { id, value: v[f.name] ?? "", "aria-invalid": !!errors[f.name], onChange: (e: { target: { value: string } }) => setV((s) => ({ ...s, [f.name]: e.target.value })) };
            return (
              <FormField
                key={f.name}
                label={f.required ? f.label : `${f.label} (optional)`}
                htmlFor={id}
                error={errors[f.name]}
                hint={f.hint}
                className={cn((f.wide || f.type === "textarea") && "sm:col-span-2")}
              >
                {f.type === "textarea" ? (
                  <Textarea rows={f.name === "forum" ? 2 : 4} maxLength={6000} {...common} />
                ) : f.type === "select" ? (
                  <NativeSelect {...common}>
                    {!f.default && <option value="">Choose…</option>}
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} maxLength={400} {...common} />
                )}
              </FormField>
            );
          })}
          <LinkPicker id="tpl-links" links={links} onChange={setLinks} targets={targets} className="sm:col-span-2" />
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground">Format</legend>
            <div className="flex gap-4 text-sm">
              {(["pdf", "docx"] as const).map((fmt) => (
                <label key={fmt} className="flex cursor-pointer items-center gap-1.5">
                  <input type="radio" name="format" value={fmt} checked={format === fmt} onChange={() => setFormat(fmt)} className="accent-gold" />
                  {fmt === "pdf" ? "PDF" : "Word (DOCX)"}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center gap-2 self-end">
            <Checkbox id="tpl-draft" checked={draft} onCheckedChange={(c) => setDraft(c === true)} />
            <Label htmlFor="tpl-draft">Mark “Draft for review” in the header</Label>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <FileDownIcon />} Generate and save
        </Button>
      </div>
    </form>
  );
}
