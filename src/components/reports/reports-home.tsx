"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClockIcon, EyeIcon, FileTextIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { fmtDate, fmtDubai } from "@/lib/dates";
import { PACKS, PACK_KEYS, PERIODS, PRINCIPAL_ONLY, SECTIONS, SECTION_KEYS, type PackKey, type SectionKey } from "@/lib/reports";
import { archiveReportAction, archiveScheduleAction, saveReportAction, saveScheduleAction, setScheduleActiveAction } from "@/server/actions/reports";

type SavedReport = { id: string; name: string; sections: string[]; period: string; shared: boolean; created_by: string | null; owner: { full_name: string } | null };
type Schedule = { id: string; pack: string | null; report_id: string | null; cadence: string; recipient_ids: string[]; active: boolean; last_notified_on: string | null; report: { name: string } | null; next: string };
type Run = { id: string; name: string; period_from: string; period_to: string; document_id: string | null; created_at: string; who: { full_name: string } | null };
type Person = { id: string; full_name: string; role: string };

export function ReportsHome({
  reports,
  schedules,
  runs,
  people,
  userId,
  isPrincipal,
}: {
  reports: SavedReport[];
  schedules: Schedule[];
  runs: Run[];
  people: Person[];
  userId: string;
  isPrincipal: boolean;
}) {
  const [editing, setEditing] = useState<SavedReport | "new" | null>(null);
  const [scheduling, setScheduling] = useState<Schedule | "new" | null>(null);
  const router = useRouter();
  const [, start] = useTransition();
  const nameOf = (id: string) => people.find((p) => p.id === id)?.full_name ?? "Former user";

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Couldn't save.");
      toast.success(msg);
      router.refresh();
    });

  return (
    <div className="space-y-8">
      <section aria-labelledby="packs-h">
        <h2 id="packs-h" className="mb-3 font-display text-lg">
          Packs
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PACK_KEYS.map((k) => (
            <PackCard key={k} k={k} isPrincipal={isPrincipal} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Saved reports</CardTitle>
              <CardDescription>Your own mix of sections. Shared reports are visible to every manager.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setEditing("new")}>
              <PlusIcon /> Build a report
            </Button>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved reports yet.</p>
            ) : (
              <ul className="divide-y">
                {reports.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0 text-sm">
                      <Link href={`/reports/view?report=${r.id}`} className="font-medium hover:text-gold-ink">
                        {r.name}
                      </Link>
                      {r.shared && (
                        <Badge variant="outline" className="ml-2 align-middle">
                          Shared
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {PERIODS[r.period as keyof typeof PERIODS] ?? r.period} · {r.sections.map((s) => SECTIONS[s as SectionKey]?.label ?? s).join(", ")}
                      </p>
                      {r.owner && r.created_by !== userId && <p className="text-xs text-muted-foreground">By {r.owner.full_name}</p>}
                    </div>
                    {(r.created_by === userId || isPrincipal) && (
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}>
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${r.name}`}
                          onClick={() => confirm(`Remove “${r.name}”? Its schedules stop too.`) && act(() => archiveReportAction(r.id), "Report removed")}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Schedules</CardTitle>
              <CardDescription>
                At 07:30 Dubai (Mondays for weekly, the 1st for monthly) each recipient gets a notification. Opening it builds the pack from that morning’s figures, under their own
                access.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setScheduling("new")}>
              <CalendarClockIcon /> Schedule
            </Button>
          </CardHeader>
          <CardContent>
            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              <ul className="divide-y">
                {schedules.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {s.pack ? PACKS[s.pack as PackKey].name : (s.report?.name ?? "Saved report")}
                        {!s.active && (
                          <Badge variant="outline" className="ml-2 align-middle">
                            Paused
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.cadence === "weekly" ? "Mondays" : "1st of the month"} · to {s.recipient_ids.map(nameOf).join(", ")}
                      </p>
                      <p className="num text-xs text-muted-foreground">
                        {s.active ? `Next ${fmtDate(s.next)}` : "Paused"}
                        {s.last_notified_on && ` · last sent ${fmtDate(s.last_notified_on)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm" onClick={() => act(() => setScheduleActiveAction(s.id, !s.active), s.active ? "Paused" : "Resumed")}>
                        {s.active ? "Pause" : "Resume"}
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Edit schedule" onClick={() => setScheduling(s)}>
                        <PencilIcon />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Remove schedule" onClick={() => confirm("Remove this schedule?") && act(() => archiveScheduleAction(s.id), "Schedule removed")}>
                        <Trash2Icon />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Email delivery needs an approved email provider; until then schedules arrive as in-app notifications.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recent reports</CardTitle>
            <CardDescription>PDFs downloaded or saved to the vault.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports generated yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{r.name}</span>{" "}
                    <span className="num text-muted-foreground">
                      {fmtDate(r.period_from)} to {fmtDate(r.period_to)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="num">
                      {fmtDubai(r.created_at)} · {r.who?.full_name ?? "—"}
                    </span>
                    {r.document_id ? (
                      <Link href={`/documents/${r.document_id}`} className="inline-flex items-center gap-1 text-foreground hover:text-gold-ink">
                        <FileTextIcon className="size-3.5" /> In vault
                      </Link>
                    ) : (
                      <span>Downloaded</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {editing && <BuilderDialog report={editing === "new" ? null : editing} isPrincipal={isPrincipal} onClose={() => setEditing(null)} />}
      {scheduling && (
        <ScheduleDialog schedule={scheduling === "new" ? null : scheduling} reports={reports} people={people} userId={userId} onClose={() => setScheduling(null)} />
      )}
    </div>
  );
}

function PackCard({ k, isPrincipal }: { k: PackKey; isPrincipal: boolean }) {
  const p = PACKS[k];
  const hidden = isPrincipal ? [] : p.sections.filter((s) => PRINCIPAL_ONLY.includes(s));
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{p.name}</CardTitle>
          <CardDescription>{p.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {PERIODS[p.period]} · {p.sections.filter((s) => !hidden.includes(s)).map((s) => SECTIONS[s].label).join(", ")}
          {hidden.length > 0 && ` (${hidden.map((s) => SECTIONS[s].label.toLowerCase()).join(", ")} for principals only)`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/reports/view?pack=${k}`}>
              <EyeIcon /> Open
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/reports/pdf?pack=${k}`} prefetch={false}>
              PDF
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BuilderDialog({ report, isPrincipal, onClose }: { report: SavedReport | null; isPrincipal: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(report?.name ?? "");
  const [period, setPeriod] = useState(report?.period ?? "last_30");
  const [sections, setSections] = useState<SectionKey[]>((report?.sections as SectionKey[]) ?? ["headline", "pipeline"]);
  const [shared, setShared] = useState(report?.shared ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const toggle = (s: SectionKey, on: boolean) => setSections((cur) => (on ? SECTION_KEYS.filter((k) => k === s || cur.includes(k)) : cur.filter((k) => k !== s)));
  const preview = `/reports/view?sections=${sections.join(",")}&period=${period}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{report ? "Edit report" : "Build a report"}</DialogTitle>
        <DialogDescription className="mt-1">Pick the sections and period. Each reader sees the figures their own access allows.</DialogDescription>
        <form
          noValidate
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveReportAction(report?.id ?? null, { name, period, sections, shared });
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success("Report saved");
              onClose();
              router.refresh();
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="rb-name" error={errors.name}>
              <Input id="rb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Investor update" />
            </FormField>
            <FormField label="Period" htmlFor="rb-period" error={errors.period}>
              <NativeSelect id="rb-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
                {Object.entries(PERIODS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Sections</legend>
            {errors.sections && <p className="mb-2 text-xs text-danger">{errors.sections}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {SECTION_KEYS.map((s) => (
                <label key={s} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm has-[[data-state=checked]]:border-gold">
                  <Checkbox className="mt-0.5" checked={sections.includes(s)} onCheckedChange={(v) => toggle(s, v === true)} aria-label={SECTIONS[s].label} />
                  <span className="min-w-0">
                    <span className="font-medium">{SECTIONS[s].label}</span>
                    <span className="block text-xs text-muted-foreground">{SECTIONS[s].description}</span>
                    {PRINCIPAL_ONLY.includes(s) && !isPrincipal && <span className="block text-xs text-muted-foreground">You won’t see this one; principals will.</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={shared} onCheckedChange={(v) => setShared(v === true)} aria-label="Share with every manager" />
            Share with every manager
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="outline" asChild disabled={!sections.length}>
              <Link href={preview}>Preview</Link>
            </Button>
            <Button type="submit" disabled={pending}>
              Save report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({ schedule, reports, people, userId, onClose }: { schedule: Schedule | null; reports: SavedReport[]; people: Person[]; userId: string; onClose: () => void }) {
  const router = useRouter();
  const [target, setTarget] = useState(schedule ? (schedule.pack ? `pack:${schedule.pack}` : `report:${schedule.report_id}`) : "pack:weekly_management");
  const [cadence, setCadence] = useState(schedule?.cadence ?? "weekly");
  const [recipients, setRecipients] = useState<string[]>(schedule?.recipient_ids ?? [userId]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle>{schedule ? "Edit schedule" : "Schedule a report"}</DialogTitle>
        <DialogDescription className="mt-1">Recipients must be managers or principals. Each sees only what their access allows.</DialogDescription>
        <form
          noValidate
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveScheduleAction(schedule?.id ?? null, { target, cadence, recipient_ids: recipients, active: schedule?.active ?? true });
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void toast.error(r.error);
              }
              toast.success("Schedule saved");
              onClose();
              router.refresh();
            });
          }}
        >
          <FormField label="Report" htmlFor="sc-target" error={errors.target}>
            <NativeSelect id="sc-target" value={target} onChange={(e) => setTarget(e.target.value)}>
              <optgroup label="Packs">
                {PACK_KEYS.map((k) => (
                  <option key={k} value={`pack:${k}`}>
                    {PACKS[k].name}
                  </option>
                ))}
              </optgroup>
              {reports.length > 0 && (
                <optgroup label="Saved reports">
                  {reports.map((r) => (
                    <option key={r.id} value={`report:${r.id}`}>
                      {r.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </NativeSelect>
          </FormField>
          <FormField label="How often" htmlFor="sc-cadence" error={errors.cadence}>
            <NativeSelect id="sc-cadence" value={cadence} onChange={(e) => setCadence(e.target.value)}>
              <option value="weekly">Weekly, on Mondays</option>
              <option value="monthly">Monthly, on the 1st</option>
            </NativeSelect>
          </FormField>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Recipients</legend>
            {errors.recipient_ids && <p className="mb-2 text-xs text-danger">{errors.recipient_ids}</p>}
            <div className="space-y-2">
              {people.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={recipients.includes(p.id)}
                    onCheckedChange={(v) => setRecipients((cur) => (v === true ? [...cur, p.id] : cur.filter((x) => x !== p.id)))}
                    aria-label={p.full_name}
                  />
                  {p.full_name} <span className="text-xs text-muted-foreground">{p.role}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Save schedule
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
