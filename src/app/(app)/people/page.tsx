import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { directory, listEmployees, myEmployeeId } from "@/server/people";
import { listViews } from "@/server/actions/views";
import { DirectoryGrid, TeamView } from "@/components/people/team-view";

export const metadata: Metadata = { title: "People & HR" };

export default async function PeoplePage() {
  const session = await getSession();
  const db = await createClient();
  if (!session.isManagerPlus) {
    const [rows, myId] = await Promise.all([directory(db), myEmployeeId(db, session.userId)]);
    return <DirectoryGrid rows={rows} myId={myId} />;
  }
  const [rows, views, logins] = await Promise.all([
    listEmployees(db),
    listViews("employees"),
    db.from("profiles").select("id, full_name, email").eq("is_active", true).neq("role", "external").order("full_name"),
  ]);
  return (
    <TeamView
      rows={rows}
      views={views}
      options={{
        employees: rows.filter((r) => r.status !== "left").map((r) => ({ value: r.id, label: r.full_name })),
        logins: (logins.data ?? []).map((p) => ({ value: p.id, label: `${p.full_name} (${p.email})` })),
      }}
    />
  );
}
