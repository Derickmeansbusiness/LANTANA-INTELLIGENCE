import "server-only";
import type { Db } from "@/lib/supabase/server";

export type Option = { value: string; label: string };

export async function stageOptions(db: Db) {
  const { data } = await db.from("pipeline_stages").select("key, label, sort_order, default_probability, is_terminal, is_won, is_advanced").order("sort_order");
  return data ?? [];
}

export async function peopleOptions(db: Db): Promise<Option[]> {
  const { data } = await db.from("profiles").select("id, full_name, role").eq("is_active", true).neq("role", "external").order("full_name");
  return (data ?? []).map((p) => ({ value: p.id, label: p.full_name }));
}

export async function orgOptions(db: Db): Promise<(Option & { type: string })[]> {
  const { data } = await db.from("organizations").select("id, name, type").is("deleted_at", null).order("name");
  return (data ?? []).map((o) => ({ value: o.id, label: o.name, type: o.type }));
}

export async function contactOptions(db: Db): Promise<(Option & { orgId: string | null })[]> {
  const { data } = await db.from("contacts").select("id, full_name, organization_id").is("deleted_at", null).order("full_name");
  return (data ?? []).map((c) => ({ value: c.id, label: c.full_name, orgId: c.organization_id }));
}

export async function countryOptions(db: Db): Promise<(Option & { region: string })[]> {
  const { data } = await db.from("countries").select("code, name, region").order("name");
  return (data ?? []).map((c) => ({ value: c.code, label: c.name, region: c.region }));
}

export async function currencyOptions(db: Db): Promise<Option[]> {
  const { data } = await db.from("currencies").select("code, name").order("code");
  return (data ?? []).map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));
}

export async function dealOptions(db: Db): Promise<Option[]> {
  const { data } = await db.from("deals").select("id, name").is("deleted_at", null).order("name");
  return (data ?? []).map((d) => ({ value: d.id, label: d.name }));
}
