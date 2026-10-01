import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, DownloadIcon, EyeIcon, FileTextIcon, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/dates";
import { fmtSize } from "@/components/documents/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Data room" };

export default async function PortalRoom(props: PageProps<"/portal/[room]">) {
  const { room: id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const { data: room } = await db.from("data_rooms").select("id, name, description, expires_on, allow_download").eq("id", id).maybeSingle();
  if (!room) notFound();
  const [{ data: docs }] = await Promise.all([db.rpc("portal_room_documents", { p_room: id }), db.rpc("log_room_open", { p_room: id })]);

  return (
    <>
      <Link href="/portal" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All rooms
      </Link>
      <h1 className="font-display text-2xl sm:text-[28px]">{room.name}</h1>
      {room.description && <p className="mt-1 text-sm">{room.description}</p>}
      <p className="mt-1 mb-6 text-xs text-muted-foreground">
        {room.allow_download ? "You can view and download these files." : "View only."} Each file opens as a PDF marked with your email and the time.
        {room.expires_on && <span className="num"> Open until {fmtDate(room.expires_on)}.</span>}
      </p>
      <Card>
        <CardContent className="p-0">
          {!docs?.length ? (
            <p className="p-6 text-sm text-muted-foreground">No files in this room yet.</p>
          ) : (
            <ul className="divide-y">
              {docs.map((d) => (
                <li key={d.document_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    {d.mime_type.startsWith("image/") ? <ImageIcon className="size-5 shrink-0 text-muted-foreground" /> : <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{d.title}</span>
                      <span className="num block text-xs text-muted-foreground">
                        {fmtSize(d.size_bytes)} · version {d.version_no} · {fmtDate(d.updated_at)}
                      </span>
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <a href={`/portal/${id}/file/${d.document_id}`} target="_blank" rel="noopener">
                        <EyeIcon /> View<span className="sr-only"> {d.title}</span>
                      </a>
                    </Button>
                    {room.allow_download && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={`/portal/${id}/file/${d.document_id}?download=1`}>
                          <DownloadIcon /> Download<span className="sr-only"> {d.title}</span>
                        </a>
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
