"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, FilePenLineIcon, GavelIcon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { fmtDate, fmtDubai, todayDubai } from "@/lib/dates";
import { RESOLUTION_STATUSES } from "@/lib/schemas/compliance";
import { label } from "@/lib/schemas/common";
import type { GovMeeting } from "@/server/compliance";
import { approveMinutesAction, saveMeetingAction, saveResolutionAction } from "@/server/actions/compliance";

type Opt = { value: string; label: string };
type Resolution = GovMeeting["resolutions"][number];

const resVariant = (s: string) => (s === "passed" ? "success" : s === "rejected" ? "danger" : s === "draft" ? "default" : "outline") as "success" | "danger" | "default" | "outline";

/** Dubai wall-clock "YYYY-MM-DDTHH:mm" for a datetime-local input. */
function toLocalInput(ts: string) {
  const d = new Date(new Date(ts).getTime() + 4 * 3600_000);
  return d.toISOString().slice(0, 16);
}

export function GovernanceView({ meetings, written, people }: { meetings: GovMeeting[]; written: Resolution[]; people: Opt[] }) {
  const [meetingDialog, setMeetingDialog] = useState<GovMeeting | "new" | null>(null);
  const [resDialog, setResDialog] = useState<{ meetingId: string | null; row: Resolution | null } | null>(null);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Board, shareholder and management meetings, their minutes, and every resolution with its status.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setResDialog({ meetingId: null, row: null })}>
            <GavelIcon /> Written resolution
          </Button>
          <Button size="sm" onClick={() => setMeetingDialog("new")}>
            <PlusIcon /> New meeting
          </Button>
        </div>
      </div>

      {meetings.length === 0 && written.length === 0 && <p className="text-sm text-muted-foreground">No governance meetings or resolutions recorded yet.</p>}

      {meetings.map((m) => (
        <Card key={m.id}>
          <CardHeader className="flex-wrap">
            <div className="min-w-0">
              <CardTitle>
                {m.title}
                {m.is_demo && <Badge variant="outline" className="ml-2 align-middle">Demo</Badge>}
              </CardTitle>
              <CardDescription>
                {label(m.kind)} meeting · <span className="num">{fmtDubai(m.starts_at, "d MMM yyyy, HH:mm")}</span>
                {m.location && ` · ${m.location}`}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setMeetingDialog(m)}>
                <PencilIcon /> Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setResDialog({ meetingId: m.id, row: null })}>
                <PlusIcon /> Resolution
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {m.notes && <p className="text-sm text-muted-foreground">{m.notes}</p>}
            <Minutes meeting={m} />
            {m.resolutions.length > 0 && <ResolutionList items={m.resolutions} onEdit={(r) => setResDialog({ meetingId: m.id, row: r })} />}
          </CardContent>
        </Card>
      ))}

      {written.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Written resolutions</CardTitle>
              <CardDescription>Passed without a meeting.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ResolutionList items={written} onEdit={(r) => setResDialog({ meetingId: null, row: r })} />
          </CardContent>
        </Card>
      )}

      {meetingDialog && <MeetingDialog row={meetingDialog === "new" ? null : meetingDialog} people={people} onClose={() => setMeetingDialog(null)} />}
      {resDialog && <ResolutionDialog meetingId={resDialog.meetingId} row={resDialog.row} onClose={() => setResDialog(null)} />}
    </div>
  );
}

function Minutes({ meeting }: { meeting: GovMeeting }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!meeting.minutes) return <p className="text-sm text-muted-foreground">No minutes yet. Edit the meeting to write them.</p>;
  return (
    <div className="rounded-md border bg-surface-2 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Minutes</p>
        {meeting.minutes_approved_at ? (
          <Badge variant="success">Approved {fmtDate(meeting.minutes_approved_at.slice(0, 10))}</Badge>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await approveMinutesAction(meeting.id);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Minutes approved");
                router.refresh();
              })
            }
          >
            <CheckIcon /> Approve minutes
          </Button>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap">{meeting.minutes}</p>
    </div>
  );
}

function ResolutionList({ items, onEdit }: { items: Resolution[]; onEdit: (r: Resolution) => void }) {
  return (
    <ul className="divide-y">
      {items.map((r) => (
        <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="font-medium">
              {r.ref_no && <span className="num mr-2 text-muted-foreground">{r.ref_no}</span>}
              {r.title}
            </p>
            {r.body && <p className="mt-0.5 max-w-3xl text-muted-foreground">{r.body}</p>}
            {r.passed_on && <p className="num text-xs text-muted-foreground">Passed {fmtDate(r.passed_on)}</p>}
          </div>
          <div className="flex items-center gap-1">
            <Badge variant={resVariant(r.status)}>{label(r.status)}</Badge>
            {r.document_id ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/documents/${r.document_id}`}>Document</Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" asChild title="Draft it on the letterhead">
                <Link href={`/documents/templates/board_resolution?${new URLSearchParams({ subject: r.title, ...(r.body ? { resolutions: r.body } : {}) })}`}>
                  <FilePenLineIcon /> Draft
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" aria-label={`Edit ${r.title}`} onClick={() => onEdit(r)}>
              <PencilIcon />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function MeetingDialog({ row, people, onClose }: { row: GovMeeting | null; people: Opt[]; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    title: row?.title ?? "",
    kind: row?.kind ?? "board",
    starts_at: row ? toLocalInput(row.starts_at) : `${todayDubai()}T10:00`,
    location: row?.location ?? "",
    attendee_ids: row?.attendee_ids ?? [],
    notes: row?.notes ?? "",
    minutes: row?.minutes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[4vh] max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{row ? "Edit meeting" : "New governance meeting"}</DialogTitle>
        <DialogDescription className="mt-1">Times are Dubai time.</DialogDescription>
        <form
          noValidate
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveMeetingAction(row?.id ?? null, v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success("Saved");
              onClose();
              router.refresh();
            });
          }}
        >
          <FormField label="Title" htmlFor="gm-title" error={errors.title} className="sm:col-span-2">
            <Input id="gm-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Board meeting: Q4 priorities" />
          </FormField>
          <FormField label="Kind" htmlFor="gm-kind">
            <NativeSelect id="gm-kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
              <option value="board">Board</option>
              <option value="shareholders">Shareholders</option>
              <option value="management">Management</option>
            </NativeSelect>
          </FormField>
          <FormField label="When" htmlFor="gm-when" error={errors.starts_at}>
            <Input id="gm-when" type="datetime-local" value={v.starts_at} onChange={(e) => setV({ ...v, starts_at: e.target.value })} />
          </FormField>
          <FormField label="Where" htmlFor="gm-where" className="sm:col-span-2">
            <Input id="gm-where" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} />
          </FormField>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">Attendees</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {people.map((p) => (
                <label key={p.value} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--brand-gold)]"
                    checked={v.attendee_ids.includes(p.value)}
                    onChange={(e) => setV({ ...v, attendee_ids: e.target.checked ? [...v.attendee_ids, p.value] : v.attendee_ids.filter((x) => x !== p.value) })}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
          <FormField label="Agenda / notes" htmlFor="gm-notes" className="sm:col-span-2">
            <Textarea id="gm-notes" rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </FormField>
          <FormField label="Minutes" htmlFor="gm-minutes" className="sm:col-span-2" hint="Who attended, what was discussed, what was decided.">
            <Textarea id="gm-minutes" rows={8} value={v.minutes} onChange={(e) => setV({ ...v, minutes: e.target.value })} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResolutionDialog({ meetingId, row, onClose }: { meetingId: string | null; row: Resolution | null; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    meeting_id: meetingId ?? "",
    ref_no: row?.ref_no ?? "",
    title: row?.title ?? "",
    body: row?.body ?? "",
    kind: row?.kind ?? "board",
    status: row?.status ?? "draft",
    passed_on: row?.passed_on ?? "",
    document_id: row?.document_id ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle>{row ? "Edit resolution" : meetingId ? "New resolution" : "Written resolution"}</DialogTitle>
        <DialogDescription className="mt-1">Draft the signed version on the letterhead from the Board Resolution template.</DialogDescription>
        <form
          noValidate
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveResolutionAction(row?.id ?? null, v);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success("Saved");
              onClose();
              router.refresh();
            });
          }}
        >
          <FormField label="Resolution" htmlFor="rs-title" error={errors.title} className="sm:col-span-2">
            <Input id="rs-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </FormField>
          <FormField label="Reference" htmlFor="rs-ref">
            <Input id="rs-ref" value={v.ref_no} onChange={(e) => setV({ ...v, ref_no: e.target.value })} placeholder="e.g. BR-2026-03" />
          </FormField>
          <FormField label="By" htmlFor="rs-kind">
            <NativeSelect id="rs-kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
              <option value="board">Board</option>
              <option value="shareholders">Shareholders</option>
              <option value="manager">Manager</option>
            </NativeSelect>
          </FormField>
          <FormField label="Text" htmlFor="rs-body" className="sm:col-span-2">
            <Textarea id="rs-body" rows={4} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} placeholder="Resolved that…" />
          </FormField>
          <FormField label="Status" htmlFor="rs-status">
            <NativeSelect id="rs-status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
              {RESOLUTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Passed on" htmlFor="rs-passed" error={errors.passed_on}>
            <Input id="rs-passed" type="date" value={v.passed_on} onChange={(e) => setV({ ...v, passed_on: e.target.value })} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
