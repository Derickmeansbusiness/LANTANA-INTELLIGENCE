import { notFound } from "next/navigation";
import { getSession } from "@/server/session";

/** Data rooms are run by managers and principals; staff get the same not-found as a hidden record. */
export default async function DataRoomsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.isManagerPlus) notFound();
  return <div className="mx-auto max-w-[1440px]">{children}</div>;
}
