import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { listLeave, myEmployeeId } from "@/server/people";
import { LeaveView } from "@/components/people/leave-view";

export const metadata: Metadata = { title: "Leave · People" };

export default async function LeavePage() {
  const session = await getSession();
  const db = await createClient();
  // RLS: staff get only their own requests and their own employee row.
  const [rows, myId, employees] = await Promise.all([
    listLeave(db),
    myEmployeeId(db, session.userId),
    db.from("employees").select("id, full_name").is("deleted_at", null).neq("status", "left").order("full_name"),
  ]);
  return (
    <LeaveView
      rows={rows}
      employees={(employees.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))}
      canDecide={session.isManagerPlus}
      myEmployeeId={myId}
    />
  );
}
