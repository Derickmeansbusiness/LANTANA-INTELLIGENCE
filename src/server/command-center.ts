import "server-only";
import { createClient } from "@/lib/supabase/server";
import { shiftDate, todayDubai, weekDays } from "@/lib/dates";

export type KpiPoint = {
  date: string;
  pipeline_usd: number;
  advanced_deals: number;
  capital_introduced_usd: number;
  cash_aed: number | null;
  burn_aed: number | null;
  overdue_tasks: number;
};

export type KpiResult = {
  series: KpiPoint[];
  role: string;
  can_see_cash: boolean;
  can_see_burn: boolean;
  missing_fx: string[];
};

export async function getKpis(from: string, to: string): Promise<KpiResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("command_center_kpis", { p_from: from, p_to: to, p_points: 16 });
  if (error) throw new Error(`KPIs failed: ${error.message}`);
  const r = data as unknown as KpiResult;
  // numeric comes back as number or string depending on size; normalise.
  r.series = r.series.map((p) => ({
    ...p,
    pipeline_usd: Number(p.pipeline_usd),
    capital_introduced_usd: Number(p.capital_introduced_usd),
    cash_aed: p.cash_aed === null ? null : Number(p.cash_aed),
    burn_aed: p.burn_aed === null ? null : Number(p.burn_aed),
  }));
  return r;
}

export type StageRow = { key: string; label: string; sort_order: number; is_terminal: boolean; is_won: boolean; deal_count: number; value_usd: number; weighted_usd: number };

export async function getPipeline(): Promise<StageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_pipeline_by_stage").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    key: r.key!,
    label: r.label!,
    sort_order: r.sort_order!,
    is_terminal: r.is_terminal!,
    is_won: r.is_won!,
    deal_count: r.deal_count ?? 0,
    value_usd: Number(r.value_usd ?? 0),
    weighted_usd: Number(r.weighted_usd ?? 0),
  }));
}

export type AttentionItem = {
  kind: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  due_date: string | null;
  entity_type: string;
  entity_id: string;
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export async function getAttention(): Promise<AttentionItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_attention_queue").select("kind, severity, title, detail, due_date, entity_type, entity_id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as AttentionItem[]).sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      a.title.localeCompare(b.title),
  );
}

export type CountryRow = { country: string; country_name: string; region: string; deal_count: number; value_usd: number; deals: { id: string; name: string; stage: string }[] };

export async function getDealsByCountry(): Promise<CountryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_deals_by_country").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    country: r.country!,
    country_name: r.country_name!,
    region: r.region!,
    deal_count: r.deal_count ?? 0,
    value_usd: Number(r.value_usd ?? 0),
    deals: (r.deals as CountryRow["deals"]) ?? [],
  }));
}

export type ActivityRow = {
  id: number;
  occurred_at: string;
  verb: string;
  summary: string;
  entity_type: string;
  entity_id: string | null;
  actor: string | null;
};

export async function getActivity(limit = 25): Promise<ActivityRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_events")
    .select("id, occurred_at, verb, summary, entity_type, entity_id, actor:profiles(full_name)")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, actor: (r.actor as { full_name: string } | null)?.full_name ?? null }));
}

export type WeekEntry = {
  day: string;
  time: string | null;
  kind: "meeting" | "task" | "deadline";
  title: string;
  entity_type: string;
  entity_id: string;
};

export async function getWeek(today = todayDubai()): Promise<{ days: string[]; entries: WeekEntry[] }> {
  const days = weekDays(today);
  const start = days[0];
  const end = days[6];
  const supabase = await createClient();
  const startTs = new Date(`${start}T00:00:00+04:00`).toISOString();
  const endTs = new Date(`${shiftDate(end, 1)}T00:00:00+04:00`).toISOString();

  const [meetings, tasks, attention] = await Promise.all([
    supabase.from("meetings").select("id, title, starts_at").is("deleted_at", null).gte("starts_at", startTs).lt("starts_at", endTs).order("starts_at"),
    supabase.from("tasks").select("id, title, due_date").is("deleted_at", null).not("status", "in", "(done,cancelled)").gte("due_date", start).lte("due_date", end),
    supabase.from("v_attention_queue").select("kind, title, due_date, entity_type, entity_id").in("kind", ["notice_deadline", "contract_expiring", "compliance_due", "survival_ending"]).gte("due_date", start).lte("due_date", end),
  ]);

  const entries: WeekEntry[] = [];
  for (const m of meetings.data ?? []) {
    const local = new Date(new Date(m.starts_at).getTime() + 4 * 3600_000).toISOString();
    entries.push({ day: local.slice(0, 10), time: local.slice(11, 16), kind: "meeting", title: m.title, entity_type: "meeting", entity_id: m.id });
  }
  for (const t of tasks.data ?? []) entries.push({ day: t.due_date!, time: null, kind: "task", title: t.title, entity_type: "task", entity_id: t.id });
  for (const a of attention.data ?? [])
    entries.push({ day: a.due_date!, time: null, kind: "deadline", title: a.kind === "notice_deadline" ? `Notice deadline: ${a.title}` : a.title!, entity_type: a.entity_type!, entity_id: a.entity_id! });

  entries.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? "99").localeCompare(b.time ?? "99"));
  return { days, entries };
}

export async function hasDemoData(): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase.from("deals").select("id", { count: "exact", head: true }).eq("is_demo", true);
  return (count ?? 0) > 0;
}
