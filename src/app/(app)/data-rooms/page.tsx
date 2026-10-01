import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listRooms, roomIsOpen } from "@/server/data-rooms";
import { dealOptions, orgOptions } from "@/server/lookups";
import { PageHeader } from "@/components/page-header";
import { RoomsList } from "@/components/data-rooms/rooms";

export const metadata: Metadata = { title: "Data rooms" };

export default async function DataRoomsPage() {
  const db = await createClient();
  const [rooms, deals, orgs] = await Promise.all([listRooms(db), dealOptions(db), orgOptions(db)]);
  return (
    <>
      <PageHeader title="Data rooms" description="Share a curated set of files with investors and counterparties, outside the app, with a record of who opened what." />
      <RoomsList rooms={rooms.map((r) => ({ ...r, open: roomIsOpen(r) }))} deals={deals} orgs={orgs} />
    </>
  );
}
