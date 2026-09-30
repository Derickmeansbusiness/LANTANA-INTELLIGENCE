"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, Link2Icon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { fmtDubai, relativeTime } from "@/lib/dates";
import { createShareAction, revokeShareAction } from "@/server/actions/documents";

export type ShareRow = {
  id: string;
  recipient_name: string;
  recipient_email: string | null;
  expires_at: string;
  max_views: number | null;
  view_count: number;
  revoked_at: string | null;
  created_at: string;
  creator: { full_name: string } | null;
  views: { viewed_at: string; outcome: string }[];
};

function state(s: ShareRow, now: number) {
  if (s.revoked_at) return { label: "Revoked", variant: "outline" as const, live: false };
  if (new Date(s.expires_at).getTime() <= now) return { label: "Expired", variant: "outline" as const, live: false };
  if (s.max_views != null && s.view_count >= s.max_views) return { label: "View limit reached", variant: "outline" as const, live: false };
  return { label: "Active", variant: "success" as const, live: true };
}

export function SharePanel({ docId, shares, canShare, reason, now }: { docId: string; shares: ShareRow[]; canShare: boolean; reason: string | null; now: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [v, setV] = useState({ recipientName: "", recipientEmail: "", days: "7", maxViews: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      {shares.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not shared outside Lantana.</p>
      ) : (
        <ul className="space-y-3">
          {shares.map((s) => {
            const st = state(s, now);
            const lastOk = s.views.filter((x) => x.outcome === "ok").sort((a, b) => b.viewed_at.localeCompare(a.viewed_at))[0];
            const refused = s.views.filter((x) => x.outcome !== "ok").length;
            return (
              <li key={s.id} className="rounded-md border p-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{s.recipient_name}</p>
                    {s.recipient_email && <p className="truncate text-xs text-muted-foreground">{s.recipient_email}</p>}
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  <span className="num">
                    {s.view_count}
                    {s.max_views != null ? ` of ${s.max_views}` : ""}
                  </span>{" "}
                  views{lastOk ? ` · last ${relativeTime(lastOk.viewed_at)}` : ""}
                  {refused > 0 && <span className="text-warning"> · {refused} refused</span>}
                  <br />
                  {st.live ? "Expires" : "Expired"} <span className="num">{fmtDubai(s.expires_at, "d MMM, HH:mm")}</span> · by {s.creator?.full_name ?? "—"}
                </p>
                {st.live && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 -ml-2 text-danger"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await revokeShareAction(docId, s.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success("Link revoked. It stops working now.");
                        router.refresh();
                      })
                    }
                  >
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canShare ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Link2Icon /> Create share link
        </Button>
      ) : (
        reason && <p className="text-xs text-muted-foreground">{reason}</p>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setCreated(null);
            setCopied(false);
            setErrors({});
            setV({ recipientName: "", recipientEmail: "", days: "7", maxViews: "" });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>{created ? "Link ready" : "Share outside Lantana"}</DialogTitle>
          {created ? (
            <div className="mt-3 space-y-3">
              <DialogDescription>Copy it now. For security it won&apos;t be shown again. Every open is logged and the PDF is watermarked with the recipient&apos;s name.</DialogDescription>
              <div className="flex gap-2">
                <Input readOnly value={created} aria-label="Share link" onFocus={(e) => e.target.select()} className="num text-xs" />
                <Button
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(created);
                    setCopied(true);
                  }}
                  aria-label="Copy link"
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </Button>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setOpen(false)}>Done</Button>
              </div>
            </div>
          ) : (
            <form
              noValidate
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await createShareAction({ documentId: docId, ...v });
                  if (!r.ok) {
                    setErrors(r.fieldErrors ?? {});
                    return void toast.error(r.error);
                  }
                  setCreated(`${window.location.origin}/s/${r.data.token}`);
                  router.refresh();
                });
              }}
            >
              <DialogDescription className="sm:col-span-2">The current version is shared as a watermarked PDF. Links expire after at most 30 days and can be revoked at any time.</DialogDescription>
              <FormField label="Recipient" htmlFor="share-name" error={errors.recipientName} className="sm:col-span-2">
                <Input id="share-name" value={v.recipientName} onChange={(e) => setV({ ...v, recipientName: e.target.value })} placeholder="Name and organization" maxLength={160} />
              </FormField>
              <FormField label="Email (for the record)" htmlFor="share-email" error={errors.recipientEmail} className="sm:col-span-2">
                <Input id="share-email" type="email" value={v.recipientEmail} onChange={(e) => setV({ ...v, recipientEmail: e.target.value })} />
              </FormField>
              <FormField label="Expires after" htmlFor="share-days">
                <NativeSelect id="share-days" value={v.days} onChange={(e) => setV({ ...v, days: e.target.value })}>
                  {[1, 3, 7, 14, 30].map((d) => (
                    <option key={d} value={d}>
                      {d} day{d > 1 ? "s" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label="View limit" htmlFor="share-max" error={errors.maxViews} hint="Blank for no limit">
                <Input id="share-max" type="number" min={1} max={1000} value={v.maxViews} onChange={(e) => setV({ ...v, maxViews: e.target.value })} />
              </FormField>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2Icon className="animate-spin" />} Create link
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
