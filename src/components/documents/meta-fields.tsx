"use client";

import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { CONFIDENTIALITY, DOC_STATUSES, DOC_TYPES } from "@/lib/schemas/documents";
import { label } from "@/lib/schemas/common";
import type { LinkTarget } from "@/server/documents";

export type DocMeta = {
  title: string;
  folder_id: string;
  doc_type: string;
  confidentiality: string;
  status: string;
  expiry_date: string;
  description: string;
  tags: string;
  links: { entity_type: LinkTarget["entity_type"]; entity_id: string }[];
};

export const EMPTY_META: DocMeta = {
  title: "",
  folder_id: "",
  doc_type: "agreement",
  confidentiality: "internal",
  status: "draft",
  expiry_date: "",
  description: "",
  tags: "",
  links: [],
};

export const metaPayload = (m: DocMeta) => ({
  ...m,
  tags: m.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean),
});

const CONF_HINT: Record<string, string> = {
  public: "Anyone at Lantana. Fine to send out.",
  internal: "Anyone at Lantana.",
  confidential: "Managers and principals, plus staff on a linked deal.",
  restricted: "Managers and principals only. Only a principal can share it.",
};

const TYPE_LABEL: Record<LinkTarget["entity_type"], string> = { deal: "Deal", organization: "Organization", contract: "Contract", project: "Project" };

export function DocMetaFields({
  v,
  set,
  errors,
  folders,
  targets,
  idPrefix = "doc",
}: {
  v: DocMeta;
  set: <K extends keyof DocMeta>(k: K, val: DocMeta[K]) => void;
  errors: Record<string, string>;
  folders: { id: string; name: string }[];
  targets: LinkTarget[];
  idPrefix?: string;
}) {
  const id = (s: string) => `${idPrefix}-${s}`;
  const linked = new Set(v.links.map((l) => `${l.entity_type}:${l.entity_id}`));
  const name = (t: string, eid: string) => targets.find((x) => x.entity_type === t && x.entity_id === eid)?.name ?? "Linked record";
  const groups = (["deal", "organization", "contract", "project"] as const).map((t) => ({ t, items: targets.filter((x) => x.entity_type === t) }));

  return (
    <>
      <FormField label="Title" htmlFor={id("title")} error={errors.title} className="sm:col-span-2">
        <Input id={id("title")} value={v.title} onChange={(e) => set("title", e.target.value)} aria-invalid={!!errors.title} maxLength={300} />
      </FormField>
      <FormField label="Type" htmlFor={id("type")}>
        <NativeSelect id={id("type")} value={v.doc_type} onChange={(e) => set("doc_type", e.target.value)}>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {label(t)}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Folder" htmlFor={id("folder")}>
        <NativeSelect id={id("folder")} value={v.folder_id} onChange={(e) => set("folder_id", e.target.value)}>
          <option value="">Unfiled</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Confidentiality" htmlFor={id("conf")} hint={CONF_HINT[v.confidentiality]}>
        <NativeSelect id={id("conf")} value={v.confidentiality} onChange={(e) => set("confidentiality", e.target.value)}>
          {CONFIDENTIALITY.map((t) => (
            <option key={t} value={t}>
              {label(t)}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Status" htmlFor={id("status")}>
        <NativeSelect id={id("status")} value={v.status} onChange={(e) => set("status", e.target.value)}>
          {DOC_STATUSES.map((t) => (
            <option key={t} value={t}>
              {label(t)}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Expiry date" htmlFor={id("expiry")} error={errors.expiry_date} hint="Alerts go out 90, 60, 30 and 7 days before.">
        <Input id={id("expiry")} type="date" value={v.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} />
      </FormField>
      <FormField label="Tags" htmlFor={id("tags")} hint="Comma-separated, e.g. KYC, Tanzania">
        <Input id={id("tags")} value={v.tags} onChange={(e) => set("tags", e.target.value)} maxLength={400} />
      </FormField>
      <div className="space-y-1.5 sm:col-span-2">
        <FormField label="Linked to" htmlFor={id("link")}>
          <NativeSelect
            id={id("link")}
            value=""
            onChange={(e) => {
              const [t, eid] = e.target.value.split(":");
              if (t && eid && !linked.has(e.target.value)) set("links", [...v.links, { entity_type: t as LinkTarget["entity_type"], entity_id: eid }]);
            }}
          >
            <option value="">Add a deal, organization, contract or project…</option>
            {groups.map(
              (g) =>
                g.items.length > 0 && (
                  <optgroup key={g.t} label={`${TYPE_LABEL[g.t]}s`}>
                    {g.items.map((x) => (
                      <option key={x.entity_id} value={`${x.entity_type}:${x.entity_id}`} disabled={linked.has(`${x.entity_type}:${x.entity_id}`)}>
                        {x.name}
                      </option>
                    ))}
                  </optgroup>
                ),
            )}
          </NativeSelect>
        </FormField>
        {v.links.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {v.links.map((l) => (
              <Badge key={`${l.entity_type}:${l.entity_id}`} variant="outline" className="gap-1 pr-1">
                <span className="text-muted-foreground">{TYPE_LABEL[l.entity_type]}:</span> {name(l.entity_type, l.entity_id)}
                <button
                  type="button"
                  aria-label={`Remove link to ${name(l.entity_type, l.entity_id)}`}
                  className="rounded p-0.5 hover:bg-surface-2"
                  onClick={() => set("links", v.links.filter((x) => !(x.entity_type === l.entity_type && x.entity_id === l.entity_id)))}
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
      <FormField label="Description" htmlFor={id("desc")} className="sm:col-span-2">
        <Textarea id={id("desc")} rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={4000} />
      </FormField>
    </>
  );
}
