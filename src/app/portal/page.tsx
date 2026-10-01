import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpenIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { fmtDate } from "@/lib/dates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Data rooms" };

export default async function PortalHome() {
  const session = await getSession();
  const db = await createClient();
  // RLS returns only open rooms this guest is a member of.
  const { data: rooms } = await db.from("data_rooms").select("id, name, description, expires_on, allow_download, docs:data_room_documents(document_id)").order("name");
  return (
    <>
      <h1 className="font-display text-2xl sm:text-[28px]">Welcome, {session.fullName}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">The rooms Lantana Vision has opened for you.</p>
      {!rooms?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No rooms are open for you right now. If you expected one, contact the person at Lantana Vision who invited you.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rooms.map((r) => (
            <li key={r.id}>
              <Card className="h-full">
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle>
                      <Link href={`/portal/${r.id}`} className="inline-flex items-center gap-2 hover:text-gold-ink">
                        <FolderOpenIcon className="size-4 shrink-0" /> {r.name}
                      </Link>
                    </CardTitle>
                    {r.description && <CardDescription>{r.description}</CardDescription>}
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  <span className="num">
                    {r.docs.length} file{r.docs.length === 1 ? "" : "s"}
                  </span>{" "}
                  · {r.allow_download ? "view and download" : "view only"}
                  {r.expires_on && <span className="num"> · open until {fmtDate(r.expires_on)}</span>}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
