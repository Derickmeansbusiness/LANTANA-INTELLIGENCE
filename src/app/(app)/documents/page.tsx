import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { linkTargets, listDocuments, listFolders } from "@/server/documents";
import { listViews } from "@/server/actions/views";
import { DocumentsView } from "@/components/documents/documents-view";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const session = await getSession();
  const db = await createClient();
  const [docs, folders, targets, views] = await Promise.all([listDocuments(db), listFolders(db), linkTargets(db), listViews("documents")]);
  return (
    <Suspense>
      <DocumentsView docs={docs} folders={folders} targets={targets} views={views} canManage={session.isManagerPlus} />
    </Suspense>
  );
}
