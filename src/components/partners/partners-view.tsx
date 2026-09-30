"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2Icon, PlusIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table/data-table";
import type { SavedView } from "@/components/data-table/types";
import { PageHeader } from "@/components/page-header";
import { formatCompact } from "@/lib/money";
import { relativeTime } from "@/lib/dates";
import { ORG_TYPES, SECTORS, label } from "@/lib/schemas/common";
import type { ContactRow, OrgRow } from "@/server/partners";
import { OrgFormDialog } from "./org-form-dialog";
import { ContactFormDialog } from "./contact-form-dialog";

type Opt = { value: string; label: string };

const ticket = (r: OrgRow) => {
  if (r.ticket_min == null && r.ticket_max == null) return "—";
  const c = r.ticket_currency ?? "USD";
  if (r.ticket_min != null && r.ticket_max != null) return `${formatCompact(r.ticket_min, c)}–${formatCompact(r.ticket_max, c).replace(/^\$|^[A-Z]{3} /, "")}`;
  return r.ticket_min != null ? `from ${formatCompact(r.ticket_min, c)}` : `up to ${formatCompact(r.ticket_max, c)}`;
};

const orgColumns: ColumnDef<OrgRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Organization",
    enableHiding: false,
    meta: { label: "Organization", className: "min-w-56" },
    cell: ({ row }) => (
      <Link href={`/partners/${row.original.id}`} className="font-medium hover:text-gold-ink">
        {row.original.name}
        {row.original.is_demo && <Badge variant="outline" className="ml-2 align-middle">Demo</Badge>}
      </Link>
    ),
  },
  { accessorKey: "type", header: "Type", meta: { label: "Type", csv: (r) => label(r.type) }, cell: ({ getValue }) => <Badge>{label(String(getValue()))}</Badge> },
  { accessorKey: "country_name", header: "Country", meta: { label: "Country" }, cell: ({ getValue }) => (getValue() as string) ?? "Multi-country" },
  {
    accessorKey: "sectors",
    header: "Sectors",
    enableSorting: false,
    meta: { label: "Sectors", csv: (r) => r.sectors.map(label).join("; "), className: "max-w-64" },
    cell: ({ row }) => <span className="line-clamp-2 text-muted-foreground">{row.original.sectors.map(label).join(", ") || "—"}</span>,
  },
  { id: "ticket", accessorFn: (r) => r.ticket_max ?? r.ticket_min, header: "Ticket", meta: { label: "Ticket range", csv: ticket }, cell: ({ row }) => <span className="num">{ticket(row.original)}</span> },
  { accessorKey: "deal_count", header: "Deals", meta: { label: "Deals", align: "right" } },
  { accessorKey: "contact_count", header: "Contacts", meta: { label: "Contacts", align: "right" } },
  { accessorKey: "owner_name", header: "Owner", meta: { label: "Relationship owner" }, cell: ({ getValue }) => (getValue() as string) ?? "—" },
  {
    accessorKey: "last_contact_at",
    header: "Last contact",
    sortUndefined: "last",
    meta: { label: "Last contact" },
    cell: ({ getValue }) => <span className="num text-muted-foreground">{getValue() ? relativeTime(getValue() as string) : "Never"}</span>,
  },
  { accessorKey: "status", header: "Status", meta: { label: "Status", csv: (r) => label(r.status) }, cell: ({ getValue }) => label(String(getValue())) },
];

const contactColumns: ColumnDef<ContactRow, unknown>[] = [
  { accessorKey: "full_name", header: "Name", enableHiding: false, meta: { label: "Name", className: "font-medium min-w-44" } },
  {
    accessorKey: "organization_name",
    header: "Organization",
    meta: { label: "Organization" },
    cell: ({ row }) => (row.original.organization_id ? <Link href={`/partners/${row.original.organization_id}`} className="hover:text-gold-ink">{row.original.organization_name}</Link> : "Independent"),
  },
  { accessorKey: "job_title", header: "Role", meta: { label: "Role" }, cell: ({ getValue }) => (getValue() as string) ?? "—" },
  { accessorKey: "email", header: "Email", meta: { label: "Email" }, cell: ({ getValue }) => (getValue() ? <a className="hover:text-gold-ink" href={`mailto:${getValue()}`}>{getValue() as string}</a> : "—") },
  { accessorKey: "phone", header: "Phone", meta: { label: "Phone" }, cell: ({ getValue }) => <span className="num">{(getValue() as string) ?? "—"}</span> },
];

export function PartnersView({
  orgs,
  contacts,
  orgViews,
  contactViews,
  canEdit,
  options,
}: {
  orgs: OrgRow[];
  contacts: ContactRow[];
  orgViews: SavedView[];
  contactViews: SavedView[];
  canEdit: boolean;
  options: { countries: Opt[]; currencies: Opt[]; people: Opt[] };
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = sp.get("tab") === "contacts" ? "contacts" : "organizations";
  const [newOrg, setNewOrg] = useState(false);
  const [newContact, setNewContact] = useState(false);
  const orgOpts = orgs.map((o) => ({ value: o.id, label: o.name }));

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Partners & Investors"
        description="Everyone Lantana works with: investors, project owners, partners, introducers, governments and suppliers."
        actions={
          canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setNewContact(true)}>
                <PlusIcon /> New contact
              </Button>
              <Button size="sm" onClick={() => setNewOrg(true)}>
                <PlusIcon /> New organization
              </Button>
            </>
          )
        }
      />
      <Tabs
        value={tab}
        onValueChange={(t) => router.replace(`${pathname}${t === "contacts" ? "?tab=contacts" : ""}`, { scroll: false })}
        className="space-y-4"
      >
        <TabsList aria-label="Directory">
          <TabsTrigger value="organizations">
            <Building2Icon /> Organizations <span className="num text-muted-foreground">{orgs.length}</span>
          </TabsTrigger>
          <TabsTrigger value="contacts">
            <UsersIcon /> Contacts <span className="num text-muted-foreground">{contacts.length}</span>
          </TabsTrigger>
        </TabsList>
        {tab === "organizations" ? (
          <DataTable
            module="partners"
            columns={orgColumns}
            data={orgs}
            views={orgViews}
            csvName="lantana-organizations"
            rowHref={(o) => `/partners/${o.id}`}
            searchPlaceholder="Search organizations…"
            defaultHidden={["contact_count", "status"]}
            facets={[
              { columnId: "type", label: "Types", options: ORG_TYPES.map((t) => ({ value: t, label: label(t) })) },
              { columnId: "sectors", label: "Sectors", options: SECTORS.map((s) => ({ value: s, label: label(s) })) },
            ]}
            empty={canEdit ? "No organizations yet. Add the first investor or partner." : "No organizations linked to your deals yet."}
          />
        ) : (
          <DataTable
            module="contacts"
            columns={contactColumns}
            data={contacts}
            views={contactViews}
            csvName="lantana-contacts"
            searchPlaceholder="Search people…"
            initialSearch={sp.get("q") ?? ""}
            empty="No contacts yet."
          />
        )}
      </Tabs>
      {canEdit && <OrgFormDialog open={newOrg} onOpenChange={setNewOrg} options={options} />}
      {canEdit && <ContactFormDialog open={newContact} onOpenChange={setNewContact} orgs={orgOpts} countries={options.countries} />}
    </div>
  );
}
