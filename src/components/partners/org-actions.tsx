"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArchiveIcon, ArchiveRestoreIcon, MessageSquarePlusIcon, PencilIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setOrganizationArchivedAction } from "@/server/actions/relationships";
import { OrgFormDialog, type OrgFormValues } from "./org-form-dialog";
import { ContactFormDialog, type ContactFormValues } from "./contact-form-dialog";
import { InteractionDialog } from "@/components/shared/interaction-dialog";

type Opt = { value: string; label: string };

export function OrgActions({
  orgId,
  archived,
  canEdit,
  initial,
  options,
  contacts,
  deals,
}: {
  orgId: string;
  archived: boolean;
  canEdit: boolean;
  initial: OrgFormValues;
  options: { countries: Opt[]; currencies: Opt[]; people: Opt[] };
  contacts: (Opt & { orgId: string | null })[];
  deals: Opt[];
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [contact, setContact] = useState(false);
  const [ix, setIx] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIx(true)}>
        <MessageSquarePlusIcon /> Log interaction
      </Button>
      {canEdit && (
        <>
          <Button variant="outline" size="sm" onClick={() => setContact(true)}>
            <UserPlusIcon /> Add contact
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
            <PencilIcon /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setOrganizationArchivedAction(orgId, !archived);
                if (!r.ok) return void toast.error(r.error);
                toast.success(archived ? "Restored" : "Archived. It stays on past deals and in the ledger.");
                router.refresh();
              })
            }
          >
            {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />} {archived ? "Restore" : "Archive"}
          </Button>
          <OrgFormDialog open={edit} onOpenChange={setEdit} orgId={orgId} initial={initial} options={options} />
          <ContactFormDialog open={contact} onOpenChange={setContact} initial={{ organization_id: orgId }} orgs={[{ value: orgId, label: initial.name }]} countries={options.countries} />
        </>
      )}
      <InteractionDialog open={ix} onOpenChange={setIx} organizationId={orgId} contacts={contacts} deals={deals} />
    </>
  );
}

export function EditContactButton({ contactId, initial, orgs, countries }: { contactId: string; initial: ContactFormValues; orgs: Opt[]; countries: Opt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon-sm" className="size-7" aria-label={`Edit ${initial.full_name}`} onClick={() => setOpen(true)}>
        <PencilIcon />
      </Button>
      <ContactFormDialog open={open} onOpenChange={setOpen} contactId={contactId} initial={initial} orgs={orgs} countries={countries} />
    </>
  );
}
