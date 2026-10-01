"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import * as reports from "@/server/reports";

async function run<R extends { ok: boolean }>(fn: (db: Awaited<ReturnType<typeof createClient>>) => Promise<R>) {
  const r = await fn(await createClient());
  if (r.ok) revalidatePath("/reports", "layout");
  return r;
}

export async function saveReportAction(id: string | null, input: { name?: unknown; period?: unknown; sections?: unknown; shared?: unknown }) {
  return run((db) => reports.saveReport(db, id, input));
}
export async function archiveReportAction(id: string) {
  return run((db) => reports.archiveReport(db, id));
}
export async function saveScheduleAction(id: string | null, input: { target?: unknown; cadence?: unknown; recipient_ids?: unknown; active?: unknown }) {
  return run((db) => reports.saveSchedule(db, id, input));
}
export async function setScheduleActiveAction(id: string, active: boolean) {
  return run((db) => reports.setScheduleActive(db, id, active));
}
export async function archiveScheduleAction(id: string) {
  return run((db) => reports.archiveSchedule(db, id));
}

/** Save a vault copy of a pack or saved report (principal-only sections are left out). */
export async function saveReportToVaultAction(q: { pack?: string; report?: string; schedule?: string; period?: string; sections?: string }) {
  const session = await getSession();
  const db = await createClient();
  const spec = await reports.resolveSpec(db, q);
  if (!spec) return { ok: false as const, error: "Report not found." };
  const r = await reports.saveReportToVault(db, session, spec);
  if (r.ok) {
    revalidatePath("/reports", "layout");
    revalidatePath("/documents", "layout");
  }
  return r;
}
