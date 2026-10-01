"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, todayDubai } from "@/lib/dates";
import { label } from "@/lib/schemas/common";
import type { LeaveRow } from "@/server/people";
import { decideLeaveAction } from "@/server/actions/people";
import { LeaveDialog } from "./leave-dialog";
import { leaveStatusVariant } from "./format";

type Opt = { value: string; label: string };

export function LeaveView({ rows, employees, canDecide, myEmployeeId }: { rows: LeaveRow[]; employees: Opt[]; canDecide: boolean; myEmployeeId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const today = todayDubai();
  const pendingRows = rows.filter((r) => r.status === "pending");
  const upcoming = rows.filter((r) => r.status === "approved" && r.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = rows.filter((r) => !pendingRows.includes(r) && !upcoming.includes(r));
  const decide = (id: string, d: "approved" | "rejected" | "cancelled") =>
    start(async () => {
      const r = await decideLeaveAction(id, d);
      if (!r.ok) return void toast.error(r.error);
      toast.success(d === "approved" ? "Approved" : d === "rejected" ? "Rejected" : "Cancelled");
      router.refresh();
    });

  const row = (r: LeaveRow, actions: boolean) => (
    <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
      <div className="min-w-0">
        <p>
          <Link href={`/people/${r.employee_id}`} className="font-medium hover:text-gold-ink">
            {r.employee}
          </Link>{" "}
          · {label(r.kind)} · <span className="num">{Number(r.days)} d</span>
          {r.is_demo && <Badge variant="outline" className="ml-2 align-middle">Demo</Badge>}
        </p>
        <p className="num text-xs text-muted-foreground">
          {fmtDate(r.start_date)} – {fmtDate(r.end_date)}
          {r.reason && <span className="font-sans"> · {r.reason}</span>}
        </p>
        {r.decided_by && r.status !== "pending" && <p className="text-xs text-muted-foreground">{label(r.status)} by {r.decided_by}</p>}
      </div>
      <div className="flex items-center gap-1">
        <Badge variant={leaveStatusVariant(r.status)}>{label(r.status)}</Badge>
        {actions && r.status === "pending" && canDecide && r.employee_id !== myEmployeeId && (
          <>
            <Button variant="ghost" size="sm" aria-label={`Approve ${r.employee}`} disabled={pending} onClick={() => decide(r.id, "approved")}>
              <CheckIcon />
            </Button>
            <Button variant="ghost" size="sm" aria-label={`Reject ${r.employee}`} disabled={pending} onClick={() => decide(r.id, "rejected")}>
              <XIcon />
            </Button>
          </>
        )}
        {actions && r.status === "pending" && r.employee_id === myEmployeeId && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => decide(r.id, "cancelled")}>
            Cancel
          </Button>
        )}
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {canDecide ? "Approve requests here or on each person's page. You can't approve your own." : "Your requests. A manager or principal approves them."}
        </p>
        {(canDecide || myEmployeeId) && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <PlusIcon /> Request leave
          </Button>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Waiting for a decision</CardTitle>
              <CardDescription>{pendingRows.length ? `${pendingRows.length} pending` : "Nothing pending."}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>{pendingRows.length > 0 && <ul className="divide-y">{pendingRows.map((r) => row(r, true))}</ul>}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Coming up</CardTitle>
              <CardDescription>Approved leave that hasn’t ended.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>{upcoming.length ? <ul className="divide-y">{upcoming.map((r) => row(r, false))}</ul> : <p className="text-sm text-muted-foreground">Nobody is off.</p>}</CardContent>
        </Card>
      </div>
      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>History, last 12 months</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">{past.map((r) => row(r, false))}</ul>
          </CardContent>
        </Card>
      )}
      <LeaveDialog open={open} onOpenChange={setOpen} employees={employees} fixedEmployee={canDecide ? undefined : (myEmployeeId ?? undefined)} />
    </div>
  );
}
