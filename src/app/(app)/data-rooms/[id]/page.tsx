import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRoom, roomDocumentOptions, roomIsOpen } from "@/server/data-rooms";
import { dealOptions, orgOptions } from "@/server/lookups";
import { PageHeader } from "@/components/page-header";
import { RoomDetail } from "@/components/data-rooms/rooms";

export const metadata: Metadata = { title: "Data room" };

export default async function DataRoomPage(props: PageProps<"/data-rooms/[id]">) {
  const { id } = await props.params;
  const db = await createClient();
  const d = await getRoom(db, id);
  if (!d) notFound();
  const [deals, orgs, docOptions] = await Promise.all([dealOptions(db), orgOptions(db), roomDocumentOptions(db)]);
  const { room } = d;
  return (
    <>
      <Link href="/data-rooms" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Data rooms
      </Link>
      <PageHeader
        title={room.name}
        description={
          <>
            {room.deal ? (
              <Link href={`/deals/${room.deal.id}`} className="hover:text-gold-ink">
                {room.deal.name}
              </Link>
            ) : (
              "Not linked to a deal"
            )}
            {room.org && (
              <>
                {" · "}
                <Link href={`/partners/${room.org.id}`} className="hover:text-gold-ink">
                  {room.org.name}
                </Link>
              </>
            )}
          </>
        }
      />
      <RoomDetail
        room={room}
        open={roomIsOpen(room)}
        members={d.members}
        documents={d.documents}
        events={d.events}
        deals={deals}
        orgs={orgs.map(({ value, label }) => ({ value, label }))}
        docOptions={docOptions}
      />
    </>
  );
}
