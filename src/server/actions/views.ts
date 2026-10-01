"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Json } from "@/lib/db/types";
import type { SavedView } from "@/components/data-table/types";

const moduleSchema = z.enum(["deals", "partners", "contacts", "tasks", "ledger", "documents", "contracts", "finance_ledger", "invoices", "bills", "employees", "compliance"]);

export async function listViews(module: string): Promise<SavedView[]> {
  const m = moduleSchema.safeParse(module);
  if (!m.success) return [];
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { data } = await supabase.from("saved_views").select("id, name, config, is_shared, user_id").eq("module", m.data).order("name");
  return (data ?? []).map((v) => ({ id: v.id, name: v.name, config: v.config as unknown as SavedView["config"], shared: v.is_shared, mine: v.user_id === claims?.claims?.sub }));
}

const saveSchema = z.object({
  module: moduleSchema,
  name: z.string().trim().min(1, "Give the view a name").max(60),
  shared: z.boolean(),
  config: z.object({
    globalFilter: z.string().max(200).default(""),
    columnFilters: z.array(z.object({ id: z.string(), value: z.unknown() })).max(20),
    sorting: z.array(z.object({ id: z.string(), desc: z.boolean() })).max(5),
    columnVisibility: z.record(z.string(), z.boolean()),
  }),
});

export async function saveView(input: z.input<typeof saveSchema>): Promise<ActionResult<SavedView>> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid view");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_views")
    .insert({ module: parsed.data.module, name: parsed.data.name, is_shared: parsed.data.shared, config: parsed.data.config as unknown as { [key: string]: Json } })
    .select("id, name, config, is_shared")
    .single();
  if (error) return fail(error);
  return ok({ id: data.id, name: data.name, config: data.config as unknown as SavedView["config"], shared: data.is_shared, mine: true });
}

export async function deleteView(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return fail("Invalid view");
  const supabase = await createClient();
  const { error } = await supabase.from("saved_views").delete().eq("id", id);
  return error ? fail(error) : ok(undefined);
}
