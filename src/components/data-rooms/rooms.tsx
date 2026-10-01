"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoorClosedIcon, DoorOpenIcon, FileTextIcon, MailIcon, PencilIcon, PlusIcon, Trash2Icon, UserMinusIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { fmtDate, fmtDubai, relativeTime } from "@/lib/dates";
import {
  addMemberAction,
  addRoomDocumentAction,
  archiveRoomAction,
  removeRoomDocumentAction,
  revokeMemberAction,
  saveRoomAction,
} from "@/server/actions/data-rooms";

type Opt = { value: string; label: string };
type Room = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  expires_on: string | null;
  allow_download: boolean;
  deal: { id: string; name: string } | null;
  org: { id: string; name: string } | null;
  members: number;
  documents: number;
  last_activity: string | null;
  open: boolean;
  is_demo: boolean;
};

export function RoomStatus({ open, status, expires_on }: { open: boolean; status: string; expires_on: string | null }) {
  if (open) return <Badge variant="success">Open</Badge>;
  return <Badge variant="outline">{status === "closed" ? "Closed" : `Expired ${fmtDate(expires_on)}`}</Badge>;
}

export function RoomsList({ rooms, deals, orgs }: { rooms: Room[]; deals: Opt[]; orgs: Opt[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Guests sign in with a one-time email link and see only the rooms they’re in. Every file is a watermarked PDF stamped with their email and the time, and every open is
          logged.
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <PlusIcon /> New room
        </Button>
      </div>
      {rooms.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No data rooms yet.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="min-w-0">
                  <CardTitle>
                    <Link href={`/data-rooms/${r.id}`} className="hover:text-gold-ink">
                      {r.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>{[r.deal?.name, r.org?.name].filter(Boolean).join(" · ") || "Not linked to a deal"}</CardDescription>
                </div>
                <RoomStatus open={r.open} status={r.status} expires_on={r.expires_on} />
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Guests</dt>
                    <dd className="num">{r.members}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Files</dt>
                    <dd className="num">{r.documents}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Expires</dt>
                    <dd className="num">{r.expires_on ? fmtDate(r.expires_on, "d MMM") : "Never"}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  {r.allow_download ? "View and download" : "View only"} · {r.last_activity ? `last activity ${relativeTime(r.last_activity)}` : "no activity yet"}
                  {r.is_demo && " · demo"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {creating && <RoomDialog room={null} deals={deals} orgs={orgs} onClose={() => setCreating(false)} />}
    </div>
  );
}

type RoomFull = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  expires_on: string | null;
  allow_download: boolean;
  deal_id: string | null;
  organization_id: string | null;
};

function RoomDialog({ room, deals, orgs, onClose }: { room: RoomFull | null; deals: Opt[]; orgs: Opt[]; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: room?.name ?? "",
    description: room?.description ?? "",
    deal_id: room?.deal_id ?? "",
    organization_id: room?.organization_id ?? "",
    expires_on: room?.expires_on ?? "",
    allow_download: room?.allow_download ?? false,
    status: room?.status ?? "open",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle>{room ? "Room settings" : "New data room"}</DialogTitle>
        <DialogDescription className="mt-1">{room ? "Closing a room or passing its expiry shuts it for every guest at once." : "New rooms expire in 90 days unless you choose a date."}</DialogDescription>
        <form
          noValidate
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveRoomAction(room?.id ?? null, v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success(room ? "Saved" : "Room created");
              onClose();
              if (room) router.refresh();
              else router.push(`/data-rooms/${r.data.id}`);
            });
          }}
        >
          <FormField label="Name" htmlFor="dr-name" error={errors.name} className="sm:col-span-2">
            <Input id="dr-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Morogoro: investor room" />
          </FormField>
          <FormField label="Note for guests" htmlFor="dr-desc" className="sm:col-span-2" hint="Shown at the top of the room.">
            <Textarea id="dr-desc" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </FormField>
          <FormField label="Deal" htmlFor="dr-deal">
            <NativeSelect id="dr-deal" value={v.deal_id} onChange={(e) => setV({ ...v, deal_id: e.target.value })}>
              <option value="">None</option>
              {deals.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Counterparty" htmlFor="dr-org">
            <NativeSelect id="dr-org" value={v.organization_id} onChange={(e) => setV({ ...v, organization_id: e.target.value })}>
              <option value="">None</option>
              {orgs.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Expires" htmlFor="dr-exp" error={errors.expires_on} hint="Last day guests can get in.">
            <Input id="dr-exp" type="date" value={v.expires_on} onChange={(e) => setV({ ...v, expires_on: e.target.value })} />
          </FormField>
          {room && (
            <FormField label="Status" htmlFor="dr-status">
              <NativeSelect id="dr-status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </NativeSelect>
            </FormField>
          )}
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <Checkbox className="mt-0.5" checked={v.allow_download} onCheckedChange={(c) => setV({ ...v, allow_download: c === true })} aria-label="Guests may download" />
            <span>
              Guests may download
              <span className="block text-xs text-muted-foreground">Downloads are watermarked and logged too. Leave off for view-only.</span>
            </span>
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {room ? "Save" : "Create room"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Member = { id: string; email: string; full_name: string | null; company: string | null; profile_id: string | null; created_at: string; revoked_at: string | null };
type Doc = { document_id: string; title: string; mime_type: string; size_bytes: number; version_no: number; updated_at: string };
type Event = { id: number; kind: string; occurred_at: string; document: { title: string } | null; who: { full_name: string; email: string } | null };

const EVENT_LABEL: Record<string, string> = { open_room: "Opened the room", view: "Viewed", download: "Downloaded" };

export function RoomDetail({
  room,
  open,
  members,
  documents,
  events,
  deals,
  orgs,
  docOptions,
}: {
  room: RoomFull;
  open: boolean;
  members: Member[];
  documents: Doc[];
  events: Event[];
  deals: Opt[];
  orgs: Opt[];
  docOptions: Opt[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [guest, setGuest] = useState({ email: "", full_name: "", company: "" });
  const [guestErr, setGuestErr] = useState<Record<string, string>>({});
  const [docId, setDocId] = useState("");
  const inRoom = new Set(documents.map((d) => d.document_id));
  const addable = docOptions.filter((o) => !inRoom.has(o.value));
  const views = new Map<string, number>();
  for (const e of events) if (e.kind !== "open_room" && e.who) views.set(e.who.email, (views.get(e.who.email) ?? 0) + 1);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Couldn't save.");
      toast.success(msg);
      after?.();
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <RoomStatus open={open} status={room.status} expires_on={room.expires_on} />
        <span className="text-sm text-muted-foreground">
          {room.allow_download ? "View and download" : "View only"} · {room.expires_on ? `expires ${fmtDate(room.expires_on)}` : "no expiry"}
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <PencilIcon /> Settings
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              act(
                () => saveRoomAction(room.id, { ...room, status: room.status === "open" ? "closed" : "open" }),
                room.status === "open" ? "Room closed for every guest" : "Room reopened",
              )
            }
          >
            {room.status === "open" ? <DoorClosedIcon /> : <DoorOpenIcon />} {room.status === "open" ? "Close room" : "Reopen"}
          </Button>
        </div>
      </div>
      {room.description && <p className="text-sm">{room.description}</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Files</CardTitle>
              <CardDescription>PDF, PNG and JPEG from the vault. Guests always get the current version, watermarked.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!docId) return;
                act(() => addRoomDocumentAction(room.id, docId), "Added to the room", () => setDocId(""));
              }}
            >
              <NativeSelect aria-label="Document to add" value={docId} onChange={(e) => setDocId(e.target.value)} className="min-w-0 flex-1">
                <option value="">Choose a vault document…</option>
                {addable.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
              <Button type="submit" size="sm" disabled={!docId || pending}>
                <PlusIcon /> Add
              </Button>
            </form>
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files in this room yet.</p>
            ) : (
              <ul className="divide-y">
                {documents.map((d) => (
                  <li key={d.document_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link href={`/documents/${d.document_id}`} className="flex min-w-0 items-center gap-2 hover:text-gold-ink">
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{d.title}</span>
                      <span className="num shrink-0 text-xs text-muted-foreground">v{d.version_no}</span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${d.title} from the room`}
                      onClick={() => act(() => removeRoomDocumentAction(room.id, d.document_id), "Removed from the room")}
                    >
                      <Trash2Icon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Guests</CardTitle>
              <CardDescription>Adding someone without an account sends nothing yet: they sign in at the login page with a one-time email link.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              noValidate
              className="grid gap-2 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await addMemberAction(room.id, guest);
                  if (!r.ok) {
                    setGuestErr(r.fieldErrors ?? {});
                    return void toast.error(r.error);
                  }
                  setGuestErr({});
                  setGuest({ email: "", full_name: "", company: "" });
                  toast.success("Guest added");
                  router.refresh();
                });
              }}
            >
              <FormField label="Email" htmlFor="g-email" error={guestErr.email}>
                <Input id="g-email" type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} />
              </FormField>
              <FormField label="Name" htmlFor="g-name">
                <Input id="g-name" value={guest.full_name} onChange={(e) => setGuest({ ...guest, full_name: e.target.value })} />
              </FormField>
              <FormField label="Company" htmlFor="g-co">
                <Input id="g-co" value={guest.company} onChange={(e) => setGuest({ ...guest, company: e.target.value })} />
              </FormField>
              <div className="sm:col-span-3 sm:text-right">
                <Button type="submit" size="sm" disabled={pending}>
                  <MailIcon /> Add guest
                </Button>
              </div>
            </form>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No guests yet.</p>
            ) : (
              <ul className="divide-y">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {m.full_name ?? m.email}
                        {m.revoked_at && (
                          <Badge variant="outline" className="ml-2 align-middle">
                            Removed
                          </Badge>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[m.email, m.company].filter(Boolean).join(" · ")} · {m.profile_id ? `${views.get(m.email) ?? 0} file opens` : "hasn’t signed in yet"}
                      </span>
                    </span>
                    {!m.revoked_at && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${m.full_name ?? m.email}`}
                        onClick={() => confirm(`Remove ${m.email} from this room? They lose access at once.`) && act(() => revokeMemberAction(m.id), "Guest removed")}
                      >
                        <UserMinusIcon />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Every room visit, view and download, newest first.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody has opened this room yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{e.who?.full_name ?? "Former guest"}</span> {EVENT_LABEL[e.kind]?.toLowerCase() ?? e.kind}
                    {e.document && <span> {e.document.title}</span>}
                  </span>
                  <span className="num text-xs text-muted-foreground">{fmtDubai(e.occurred_at, "d MMM yyyy, HH:mm")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-danger"
          onClick={() => confirm("Archive this room? Guests lose access; the activity log is kept.") && act(() => archiveRoomAction(room.id), "Room archived", () => router.push("/data-rooms"))}
        >
          <Trash2Icon /> Archive room
        </Button>
      </div>

      {editing && <RoomDialog room={room} deals={deals} orgs={orgs} onClose={() => setEditing(false)} />}
    </div>
  );
}
