import "server-only";
import type { Db } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { daysBetween, fmtDate, fmtDubai, shiftDate, todayDubai } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { buildPnl, monthsBetween, type MonthlyRow } from "@/lib/finance";
import {
  PACKS,
  PERIODS,
  PRINCIPAL_ONLY,
  SECTIONS,
  isPackKey,
  isPeriodKey,
  isSectionKey,
  periodRange,
  vaultSafeSections,
  type PackKey,
  type PeriodKey,
  type SectionKey,
} from "@/lib/reports";
import type { Block } from "@/lib/templates/types";
import type { SessionContext } from "@/server/session";
import { budgetVsActual, financeOverview } from "@/server/finance";
import { listContracts } from "@/server/contracts";
import { complianceSummary, listRecords } from "@/server/compliance";
import { listEmployees, listLeave } from "@/server/people";
import { renderTemplatePdf } from "@/server/templates/render-pdf";
import { saveGeneratedFile } from "@/server/templates/save";

/**
 * Reports. Every section is computed under the reader's own session, so a
 * pack never shows anyone more than the app already does. Cash is computed
 * only for an MFA-verified principal and never written to the vault.
 */

export type ReportStat = { label: string; value: string };
export type ReportTable = { caption?: string; head: string[]; rows: string[][]; align?: ("left" | "right")[] };
export type ReportChart =
  | { kind: "bars"; title: string; unit: string; points: { label: string; value: number }[] }
  | { kind: "inout"; title: string; unit: string; inLabel: string; outLabel: string; points: { label: string; in: number; out: number }[] };
export type ReportSection = {
  key: SectionKey;
  title: string;
  stats: ReportStat[];
  chart?: ReportChart;
  tables: ReportTable[];
  notes: string[];
};
export type Report = {
  name: string;
  period: PeriodKey;
  periodLabel: string;
  from: string;
  to: string;
  generatedAt: string;
  preparedFor: string;
  sections: ReportSection[];
  /** Sections asked for but left out, and why. */
  omitted: { key: SectionKey; reason: string }[];
};

export type ReportSpec = { name: string; period: PeriodKey; sections: SectionKey[]; pack?: PackKey; reportId?: string };

const aed = (v: number) => formatMoney(Math.round(v) || 0, "AED");
const usd = (v: number) => formatMoney(Math.round(v) || 0, "USD");
const int = (n: number) => n.toLocaleString("en-GB");
const dubaiStart = (d: string) => new Date(`${d}T00:00:00+04:00`).toISOString();

// ---------------------------------------------------------------- resolve what to build

/** A pack, saved report or schedule, as a spec. Null when the caller can't see it. */
export async function resolveSpec(
  db: Db,
  q: { pack?: string; report?: string; schedule?: string; period?: string; sections?: string },
): Promise<ReportSpec | null> {
  const period = q.period && isPeriodKey(q.period) ? q.period : undefined;
  if (q.schedule) {
    const { data } = await db.from("report_schedules").select("pack, report_id").eq("id", q.schedule).is("deleted_at", null).maybeSingle();
    if (!data) return null;
    return resolveSpec(db, { pack: data.pack ?? undefined, report: data.report_id ?? undefined, period: q.period });
  }
  if (q.report) {
    const { data } = await db.from("reports").select("id, name, period, sections").eq("id", q.report).is("deleted_at", null).maybeSingle();
    if (!data) return null;
    return { name: data.name, period: period ?? (isPeriodKey(data.period) ? data.period : "last_30"), sections: data.sections.filter(isSectionKey), reportId: data.id };
  }
  if (q.pack && isPackKey(q.pack)) {
    const p = PACKS[q.pack];
    return { name: p.name, period: period ?? p.period, sections: [...p.sections], pack: q.pack };
  }
  if (q.sections) {
    const sections = [...new Set(q.sections.split(",").filter(isSectionKey))];
    if (!sections.length) return null;
    return { name: "Custom report", period: period ?? "last_30", sections };
  }
  return null;
}

// ---------------------------------------------------------------- build

export async function buildReport(db: Db, session: SessionContext, spec: ReportSpec, opts: { forVault?: boolean } = {}): Promise<Report> {
  const today = todayDubai();
  const range = periodRange(spec.period, today);
  const omitted: Report["omitted"] = [];
  let keys = spec.sections;
  if (opts.forVault) {
    for (const k of keys) if (PRINCIPAL_ONLY.includes(k)) omitted.push({ key: k, reason: "Not saved to the vault: principals only." });
    keys = vaultSafeSections(keys);
  } else if (!session.isPrincipal) {
    for (const k of keys) if (PRINCIPAL_ONLY.includes(k)) omitted.push({ key: k, reason: "Principals only (with two-step sign-in)." });
    keys = keys.filter((k) => !PRINCIPAL_ONLY.includes(k));
  }
  const includeCash = session.isPrincipal && !opts.forVault;
  const ctx: Ctx = { db, today, from: range.from, to: range.to, includeCash, overview: null };

  const sections: ReportSection[] = [];
  for (const k of keys) {
    try {
      sections.push(await BUILDERS[k](ctx));
    } catch {
      sections.push({ key: k, title: SECTIONS[k].label, stats: [], tables: [], notes: ["This section couldn't be loaded. Try again."] });
    }
  }
  return {
    name: spec.name,
    period: spec.period,
    periodLabel: PERIODS[spec.period],
    from: range.from,
    to: range.to,
    generatedAt: fmtDubai(new Date(), "d MMM yyyy, HH:mm"),
    preparedFor: session.fullName,
    sections,
    omitted,
  };
}

type Ctx = {
  db: Db;
  today: string;
  from: string;
  to: string;
  includeCash: boolean;
  overview: Promise<Awaited<ReturnType<typeof financeOverview>>> | null;
};

function overview(c: Ctx) {
  c.overview ??= financeOverview(c.db, { months: 6, principal: c.includeCash });
  return c.overview;
}

const BUILDERS: Record<SectionKey, (c: Ctx) => Promise<ReportSection>> = {
  async headline(c) {
    const { data, error } = await c.db.rpc("command_center_kpis", { p_from: c.from, p_to: c.to, p_points: 2 });
    if (error) throw error;
    const r = data as unknown as {
      series: { pipeline_usd: number; advanced_deals: number; capital_introduced_usd: number; cash_aed: number | null; burn_aed: number | null; overdue_tasks: number }[];
      can_see_cash: boolean;
      can_see_burn: boolean;
    };
    const first = r.series[0];
    const last = r.series.at(-1);
    if (!last) return { key: "headline", title: SECTIONS.headline.label, stats: [], tables: [], notes: ["No figures for this period."] };
    const delta = (a: number, b: number, f: (n: number) => string) => {
      const d = Number(a) - Number(b);
      return d === 0 ? "" : ` (${d > 0 ? "+" : "−"}${f(Math.abs(d))} in period)`;
    };
    const stats: ReportStat[] = [
      { label: "Open pipeline", value: usd(Number(last.pipeline_usd)) + (first ? delta(last.pipeline_usd, first.pipeline_usd, usd) : "") },
      { label: "Deals at term sheet or later", value: int(last.advanced_deals) },
      { label: "Capital introduced", value: usd(Number(last.capital_introduced_usd)) },
      { label: "Overdue tasks", value: int(last.overdue_tasks) },
    ];
    if (r.can_see_burn && last.burn_aed != null) stats.push({ label: "Monthly burn", value: aed(Number(last.burn_aed)) });
    if (c.includeCash && r.can_see_cash && last.cash_aed != null) stats.push({ label: "Cash on hand", value: aed(Number(last.cash_aed)) });
    return { key: "headline", title: SECTIONS.headline.label, stats, tables: [], notes: [`Figures as at ${fmtDate(c.to)}.`] };
  },

  async attention(c) {
    const { data, error } = await c.db.from("v_attention_queue").select("severity, title, detail, due_date");
    if (error) throw error;
    const order = { high: 0, medium: 1, low: 2 } as Record<string, number>;
    const rows = (data ?? []).sort((a, b) => (order[a.severity!] ?? 3) - (order[b.severity!] ?? 3) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    const high = rows.filter((r) => r.severity === "high").length;
    return {
      key: "attention",
      title: SECTIONS.attention.label,
      stats: [
        { label: "Items", value: int(rows.length) },
        { label: "High priority", value: int(high) },
      ],
      tables: rows.length
        ? [{ head: ["Priority", "Item", "Detail", "Due"], rows: rows.slice(0, 15).map((r) => [cap(r.severity ?? ""), r.title ?? "", r.detail ?? "", r.due_date ? fmtDate(r.due_date) : "—"]) }]
        : [],
      notes: rows.length > 15 ? [`Showing 15 of ${rows.length}.`] : rows.length ? [] : ["Nothing needs attention."],
    };
  },

  async pipeline(c) {
    const { data, error } = await c.db.from("v_pipeline_by_stage").select("*").order("sort_order");
    if (error) throw error;
    const open = (data ?? []).filter((s) => !s.is_terminal);
    const total = open.reduce((s, r) => s + Number(r.value_usd ?? 0), 0);
    const weighted = open.reduce((s, r) => s + Number(r.weighted_usd ?? 0), 0);
    const count = open.reduce((s, r) => s + (r.deal_count ?? 0), 0);
    return {
      key: "pipeline",
      title: SECTIONS.pipeline.label,
      stats: [
        { label: "Open deals", value: int(count) },
        { label: "Pipeline value", value: usd(total) },
        { label: "Weighted value", value: usd(weighted) },
      ],
      chart: { kind: "bars", title: "Pipeline value by stage (USD)", unit: "USD", points: open.map((s) => ({ label: s.label!, value: Math.round(Number(s.value_usd ?? 0)) })) },
      tables: [
        {
          head: ["Stage", "Deals", "Value (USD)", "Weighted (USD)"],
          align: ["left", "right", "right", "right"],
          rows: open.map((s) => [s.label!, int(s.deal_count ?? 0), usd(Number(s.value_usd ?? 0)), usd(Number(s.weighted_usd ?? 0))]),
        },
      ],
      notes: ["Deal values are converted to USD at the latest rates; a deal with no rate counts as zero."],
    };
  },

  async stage_moves(c) {
    const [hist, stages] = await Promise.all([
      c.db
        .from("deal_stage_history")
        .select("changed_at, from_stage, to_stage, note, deal:deals(name)")
        .gte("changed_at", dubaiStart(c.from))
        .lt("changed_at", dubaiStart(shiftDate(c.to, 1)))
        .order("changed_at")
        .returns<{ changed_at: string; from_stage: string | null; to_stage: string; note: string | null; deal: { name: string } | null }[]>(),
      c.db.from("pipeline_stages").select("key, label, is_terminal, is_won"),
    ]);
    if (hist.error) throw hist.error;
    const st = new Map((stages.data ?? []).map((s) => [s.key, s]));
    const label = (k: string | null) => (k ? (st.get(k)?.label ?? k) : "New");
    const rows = hist.data ?? [];
    const won = rows.filter((r) => st.get(r.to_stage)?.is_won).length;
    const lost = rows.filter((r) => st.get(r.to_stage)?.is_terminal && !st.get(r.to_stage)?.is_won).length;
    return {
      key: "stage_moves",
      title: SECTIONS.stage_moves.label,
      stats: [
        { label: "Stage changes", value: int(rows.length) },
        { label: "Won", value: int(won) },
        { label: "Lost", value: int(lost) },
      ],
      tables: rows.length
        ? [
            {
              head: ["Date", "Deal", "From", "To", "Note"],
              rows: rows.map((r) => [fmtDubai(r.changed_at, "d MMM"), r.deal?.name ?? "—", r.from_stage ? label(r.from_stage) : "New", label(r.to_stage), r.note ?? ""]),
            },
          ]
        : [],
      notes: rows.length ? [] : ["No deal changed stage in this period."],
    };
  },

  async introductions(c) {
    const { data, error } = await c.db
      .from("introductions")
      .select(
        "seq, introduced_on, channel, corrects_id, a:organizations!introductions_party_a_org_id_fkey(name), b:organizations!introductions_party_b_org_id_fkey(name), deal:deals(name)",
      )
      .gte("introduced_on", c.from)
      .lte("introduced_on", c.to)
      .order("seq")
      .returns<{ seq: number; introduced_on: string; channel: string; corrects_id: string | null; a: { name: string } | null; b: { name: string } | null; deal: { name: string } | null }[]>();
    if (error) throw error;
    const rows = data ?? [];
    const originals = rows.filter((r) => !r.corrects_id);
    return {
      key: "introductions",
      title: SECTIONS.introductions.label,
      stats: [
        { label: "Introductions", value: int(originals.length) },
        { label: "Corrections", value: int(rows.length - originals.length) },
      ],
      tables: rows.length
        ? [
            {
              head: ["#", "Date", "Introduced", "To", "Deal", "Channel"],
              rows: rows.map((r) => [`${r.seq}${r.corrects_id ? " (correction)" : ""}`, fmtDate(r.introduced_on), r.a?.name ?? "?", r.b?.name ?? "?", r.deal?.name ?? "—", cap(r.channel)]),
            },
          ]
        : [],
      notes: rows.length ? [] : ["No introductions recorded in this period."],
    };
  },

  async tasks(c) {
    const [overdue, done, soon] = await Promise.all([
      c.db
        .from("tasks")
        .select("title, due_date, priority, assignee:profiles!tasks_assignee_id_fkey(full_name)")
        .is("deleted_at", null)
        .not("status", "in", "(done,cancelled)")
        .lt("due_date", c.today)
        .order("due_date")
        .returns<{ title: string; due_date: string; priority: string; assignee: { full_name: string } | null }[]>(),
      c.db
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "done")
        .gte("completed_at", dubaiStart(c.from))
        .lt("completed_at", dubaiStart(shiftDate(c.to, 1))),
      c.db
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .not("status", "in", "(done,cancelled)")
        .gte("due_date", c.today)
        .lte("due_date", shiftDate(c.today, 7)),
    ]);
    if (overdue.error) throw overdue.error;
    const rows = overdue.data ?? [];
    return {
      key: "tasks",
      title: SECTIONS.tasks.label,
      stats: [
        { label: "Completed in period", value: int(done.count ?? 0) },
        { label: "Overdue now", value: int(rows.length) },
        { label: "Due in the next 7 days", value: int(soon.count ?? 0) },
      ],
      tables: rows.length
        ? [
            {
              caption: "Overdue",
              head: ["Task", "Owner", "Due", "Days late"],
              align: ["left", "left", "left", "right"],
              rows: rows.slice(0, 15).map((t) => [t.title, t.assignee?.full_name ?? "Unassigned", fmtDate(t.due_date), int(daysBetween(t.due_date, c.today))]),
            },
          ]
        : [],
      notes: rows.length > 15 ? [`Showing the 15 oldest of ${rows.length} overdue tasks.`] : [],
    };
  },

  async pnl(c) {
    const months = monthsBetween(`${c.from.slice(0, 7)}-01`, c.to);
    const { data, error } = await c.db.rpc("finance_monthly", { p_from: c.from, p_to: c.to });
    if (error) throw error;
    const p = buildPnl((data ?? []) as MonthlyRow[], months);
    const lines = [...p.income, ...p.expense].filter((l) => Math.round(l.total) !== 0);
    const notes = ["In AED at each transaction's date. Payroll is included in aggregate."];
    if (p.missingFx) notes.push(`${p.missingFx} transaction${p.missingFx === 1 ? "" : "s"} left out: no exchange rate for the date.`);
    return {
      key: "pnl",
      title: SECTIONS.pnl.label,
      stats: [
        { label: "Income", value: aed(p.totals.income) },
        { label: "Costs", value: aed(p.totals.expense) },
        { label: "Net", value: aed(p.totals.net) },
      ],
      chart:
        months.length > 1
          ? {
              kind: "inout",
              title: "Income and costs by month (AED)",
              unit: "AED",
              inLabel: "Income",
              outLabel: "Costs",
              points: months.map((m) => ({ label: fmtDate(m, "MMM yyyy"), in: Math.round(p.incomeByMonth[m] ?? 0), out: Math.round(p.expenseByMonth[m] ?? 0) })),
            }
          : undefined,
      tables: lines.length
        ? [
            {
              head: ["Account", "Type", "AED"],
              align: ["left", "left", "right"],
              rows: [
                ...lines.map((l) => [l.code ? `${l.code} ${l.name}` : l.name, l.type === "income" ? "Income" : "Cost", aed(l.total)]),
                ["Net", "", aed(p.totals.net)],
              ],
            },
          ]
        : [],
      notes: lines.length ? notes : ["No income or costs recorded in this period.", ...notes.slice(1)],
    };
  },

  async cash(c) {
    if (!c.includeCash) return { key: "cash", title: SECTIONS.cash.label, stats: [], tables: [], notes: ["Principals only."] };
    const o = await overview(c);
    const cash = o.cash;
    if (!cash) return { key: "cash", title: SECTIONS.cash.label, stats: [], tables: [], notes: ["No bank accounts recorded yet."] };
    return {
      key: "cash",
      title: SECTIONS.cash.label,
      stats: [
        { label: "Cash on hand", value: cash.now == null ? "No balance recorded" : aed(cash.now) },
        { label: "Runway", value: cash.runway == null ? "Cash is not falling" : `${cash.runway.toFixed(1)} months` },
      ],
      chart: {
        kind: "inout",
        title: "Cash in and out by month (AED)",
        unit: "AED",
        inLabel: "In",
        outLabel: "Out",
        points: cash.series.map((s) => ({ label: fmtDate(s.month, "MMM yyyy"), in: Math.round(s.inflow), out: Math.round(s.outflow) })),
      },
      tables: [
        {
          head: ["Month", "In", "Out", "Closing"],
          align: ["left", "right", "right", "right"],
          rows: cash.series.map((s) => [fmtDate(s.month, "MMM yyyy"), aed(s.inflow), aed(s.outflow), s.closing == null ? "—" : aed(s.closing)]),
        },
      ],
      notes: [`Runway uses the average of the last ${cash.basis} complete month${cash.basis === 1 ? "" : "s"}. Principals only; never saved to the vault.`],
    };
  },

  async receivables(c) {
    const o = await overview(c);
    const buckets = ["current", "1-30", "31-60", "61-90", "90+"] as const;
    const name = { current: "Not yet due", "1-30": "1–30 days late", "31-60": "31–60 days late", "61-90": "61–90 days late", "90+": "Over 90 days late" };
    const notes: string[] = ["Open invoices and bills in AED at the latest rates."];
    const missing = o.receivables.missing + o.payables.missing;
    if (missing) notes.push(`${missing} item${missing === 1 ? "" : "s"} left out: no exchange rate.`);
    return {
      key: "receivables",
      title: SECTIONS.receivables.label,
      stats: [
        { label: "Owed to Lantana", value: `${aed(o.receivables.total)} (${o.receivables.count})` },
        { label: "Owed by Lantana", value: `${aed(o.payables.total)} (${o.payables.count})` },
      ],
      tables: [
        {
          head: ["Age", "Owed to Lantana", "Owed by Lantana"],
          align: ["left", "right", "right"],
          rows: buckets.map((b) => [name[b], aed(o.receivables.buckets[b]), aed(o.payables.buckets[b])]),
        },
      ],
      notes,
    };
  },

  async budget(c) {
    // The last full month that ends on or before the period end.
    const endsMonth = shiftDate(c.to, 1).slice(8, 10) === "01";
    const month = endsMonth ? `${c.to.slice(0, 7)}-01` : `${shiftDate(`${c.to.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
    const { lines, missingFx } = await budgetVsActual(c.db, month);
    const used = lines.filter((l) => l.budget != null || Math.round(l.actual) !== 0);
    const notes = [`${fmtDate(month, "MMMM yyyy")}, in AED. Positive variance is good: income above budget, spending below it.`];
    if (missingFx) notes.push(`${missingFx} transaction${missingFx === 1 ? "" : "s"} left out: no exchange rate.`);
    if (!used.length) notes.unshift("No budget or actuals for this month.");
    return {
      key: "budget",
      title: SECTIONS.budget.label,
      stats: [],
      chart: used.some((l) => l.budget != null)
        ? {
            kind: "inout",
            title: `Budget and actual, ${fmtDate(month, "MMM yyyy")} (AED)`,
            unit: "AED",
            inLabel: "Budget",
            outLabel: "Actual",
            points: used.filter((l) => l.budget != null).map((l) => ({ label: l.name, in: Math.round(l.budget ?? 0), out: Math.round(l.actual) })),
          }
        : undefined,
      tables: used.length
        ? [
            {
              head: ["Account", "Budget", "Actual", "Variance"],
              align: ["left", "right", "right", "right"],
              rows: used.map((l) => [`${l.code} ${l.name}`, l.budget == null ? "—" : aed(l.budget), aed(l.actual), l.variance == null ? "—" : aed(l.variance)]),
            },
          ]
        : [],
      notes,
    };
  },

  async contracts(c) {
    const rows = (await listContracts(c.db)).filter((k) => k.next_date && k.days_left != null && k.days_left <= 90);
    const flagged = rows.filter((k) => k.flags.length).length;
    return {
      key: "contracts",
      title: SECTIONS.contracts.label,
      stats: [
        { label: "Dates in the next 90 days", value: int(rows.length) },
        { label: "With open flags", value: int(flagged) },
      ],
      tables: rows.length
        ? [
            {
              head: ["Contract", "Counterparty", "What", "Date", "Days"],
              align: ["left", "left", "left", "left", "right"],
              rows: rows.map((k) => [k.title, k.counterparty ?? "—", k.next_label ?? "", fmtDate(k.next_date), int(k.days_left ?? 0)]),
            },
          ]
        : [],
      notes: rows.length ? [] : ["No contract dates in the next 90 days."],
    };
  },

  async compliance(c) {
    const [s, records] = await Promise.all([complianceSummary(c.db), listRecords(c.db)]);
    const horizon = shiftDate(c.today, 90);
    const due = s.upcoming.filter((u) => u.due_date! <= horizon);
    const expiring = records.filter((r) => r.expiry_date && r.expiry_date <= horizon);
    const rows = [
      ...due.map((u) => ({ date: u.due_date!, cells: [u.title, u.overdue ? "Overdue" : "Due", fmtDate(u.due_date), u.owner ?? "—"] })),
      ...expiring.map((r) => ({ date: r.expiry_date!, cells: [r.title, r.expiry_date! < c.today ? "Expired" : "Expires", fmtDate(r.expiry_date), r.holder ?? "Company"] })),
    ]
      .sort((x, y) => x.date.localeCompare(y.date))
      .map((x) => x.cells);
    return {
      key: "compliance",
      title: SECTIONS.compliance.label,
      stats: [
        { label: "Deadlines in the next 90 days", value: int(due.length) },
        { label: "Overdue", value: int(due.filter((u) => u.overdue).length) },
        { label: "Records expiring", value: int(expiring.length) },
        { label: "Awaiting a principal's confirmation", value: int(s.unconfirmed.length) },
      ],
      tables: rows.length
        ? [
            {
              head: ["Item", "Status", "Date", "Owner"],
              rows,
            },
          ]
        : [],
      notes: s.unconfirmed.length ? [`${s.unconfirmed.length} item${s.unconfirmed.length === 1 ? "" : "s"} still need a principal to confirm whether they apply; they drive no alerts until then.`] : [],
    };
  },

  async people(c) {
    const [employees, leave] = await Promise.all([listEmployees(c.db), listLeave(c.db, { since: c.today })]);
    const active = employees.filter((e) => e.status !== "left");
    const expiries = active.filter((e) => e.next_expiry && e.next_expiry.date <= shiftDate(c.today, 60));
    const upcoming = leave.filter((l) => ["approved", "pending"].includes(l.status) && l.start_date <= shiftDate(c.today, 30));
    const tables: ReportTable[] = [];
    if (upcoming.length)
      tables.push({
        caption: "Leave in the next 30 days",
        head: ["Person", "Kind", "From", "To", "Status"],
        rows: upcoming.map((l) => [l.employee, cap(l.kind), fmtDate(l.start_date), fmtDate(l.end_date), cap(l.status)]),
      });
    if (expiries.length)
      tables.push({
        caption: "Documents expiring in the next 60 days",
        head: ["Person", "Document", "Expires"],
        rows: expiries.map((e) => [e.full_name, e.next_expiry!.what, fmtDate(e.next_expiry!.date)]),
      });
    return {
      key: "people",
      title: SECTIONS.people.label,
      stats: [
        { label: "Headcount", value: int(active.length) },
        { label: "On leave or requested, next 30 days", value: int(upcoming.length) },
        { label: "Document expiries, next 60 days", value: int(expiries.length) },
      ],
      tables,
      notes: tables.length ? [] : ["No leave or document expiries coming up."],
    };
  },
};

function cap(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---------------------------------------------------------------- PDF

export function reportBlocks(r: Report): Block[] {
  const blocks: Block[] = [
    { kind: "title", text: r.name, sub: `${r.periodLabel}: ${fmtDate(r.from)} to ${fmtDate(r.to)}` },
    {
      kind: "meta",
      rows: [
        ["Prepared for", r.preparedFor],
        ["Generated", `${r.generatedAt} (Dubai)`],
      ],
    },
  ];
  for (const s of r.sections) {
    blocks.push({ kind: "heading", text: s.title });
    if (s.stats.length) blocks.push({ kind: "meta", rows: s.stats.map((x) => [x.label, x.value]) });
    if (s.chart && !s.tables.length) blocks.push(chartTable(s.chart));
    for (const t of s.tables) {
      if (t.caption) blocks.push({ kind: "para", text: t.caption });
      blocks.push({ kind: "table", head: t.head, rows: t.rows, align: t.align });
    }
    for (const n of s.notes) blocks.push({ kind: "note", text: n });
  }
  for (const o of r.omitted) blocks.push({ kind: "note", text: `${SECTIONS[o.key].label}: ${o.reason}` });
  blocks.push({ kind: "note", text: "Confidential. Prepared from Lantana Command records under the reader's own access; figures are unaudited." });
  return blocks;
}

function chartTable(c: ReportChart): Block {
  return c.kind === "bars"
    ? { kind: "table", head: ["", c.unit], rows: c.points.map((p) => [p.label, int(p.value)]), align: ["left", "right"] }
    : { kind: "table", head: ["", c.inLabel, c.outLabel], rows: c.points.map((p) => [p.label, int(p.in), int(p.out)]), align: ["left", "right", "right"] };
}

async function companyAddress(db: Db) {
  const { data } = await db.from("company").select("address_lines").maybeSingle();
  return data?.address_lines ?? [];
}

export async function reportPdf(db: Db, r: Report) {
  return Buffer.from(await renderTemplatePdf({ title: r.name, blocks: reportBlocks(r), address: await companyAddress(db), draft: false }));
}

export function reportFileTitle(r: Report) {
  return `${r.name}, ${fmtDate(r.from)} to ${fmtDate(r.to)}`;
}

/** Render, store a vault copy without principal-only sections, and log the run. */
export async function saveReportToVault(db: Db, session: SessionContext, spec: ReportSpec): Promise<ActionResult<{ documentId: string }>> {
  if (!session.isManagerPlus) return fail("Only a manager or principal can save reports.");
  const r = await buildReport(db, session, spec, { forVault: true });
  if (!r.sections.length) return fail("Nothing left to save: every section in this report is principals only.");
  const saved = await saveGeneratedFile(db, {
    title: reportFileTitle(r),
    docType: "report",
    confidentiality: "confidential",
    status: "final",
    description: `${r.name} for ${fmtDate(r.from)} to ${fmtDate(r.to)}, generated by ${session.fullName}.${r.omitted.length ? " Cash and runway are left out of vault copies." : ""}`,
    tags: ["Report"],
    format: "pdf",
    buf: await reportPdf(db, r),
    note: "Generated report",
  });
  if (!saved.ok) return saved;
  await logRun(db, spec, r, saved.data.id);
  return ok({ documentId: saved.data.id });
}

export async function logRun(db: Db, spec: ReportSpec, r: Report, documentId: string | null) {
  await db.from("report_runs").insert({ pack: spec.pack ?? null, report_id: spec.reportId ?? null, name: r.name, period_from: r.from, period_to: r.to, document_id: documentId });
}

// ---------------------------------------------------------------- saved reports, schedules, runs

export async function listReportsPage(db: Db) {
  const [reports, schedules, runs, people] = await Promise.all([
    db.from("reports").select("id, name, sections, period, shared, created_by, owner:profiles!reports_created_by_fkey(full_name)").is("deleted_at", null).order("name"),
    db.from("report_schedules").select("id, pack, report_id, cadence, recipient_ids, active, last_notified_on, report:reports(name)").is("deleted_at", null).order("created_at"),
    db.from("report_runs").select("id, pack, report_id, name, period_from, period_to, document_id, created_at, who:profiles!report_runs_created_by_fkey(full_name)").order("created_at", { ascending: false }).limit(15),
    db.from("profiles").select("id, full_name, role").in("role", ["principal", "manager"]).eq("is_active", true).order("full_name"),
  ]);
  return {
    reports: (reports.data ?? []) as unknown as { id: string; name: string; sections: string[]; period: string; shared: boolean; created_by: string | null; owner: { full_name: string } | null }[],
    schedules: (schedules.data ?? []) as unknown as {
      id: string;
      pack: string | null;
      report_id: string | null;
      cadence: string;
      recipient_ids: string[];
      active: boolean;
      last_notified_on: string | null;
      report: { name: string } | null;
    }[],
    runs: (runs.data ?? []) as unknown as {
      id: string;
      pack: string | null;
      report_id: string | null;
      name: string;
      period_from: string;
      period_to: string;
      document_id: string | null;
      created_at: string;
      who: { full_name: string } | null;
    }[],
    recipients: people.data ?? [],
  };
}

export async function saveReport(db: Db, id: string | null, input: { name?: unknown; period?: unknown; sections?: unknown; shared?: unknown }): Promise<ActionResult<{ id: string }>> {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 120) : "";
  const period = typeof input.period === "string" && isPeriodKey(input.period) ? input.period : null;
  const sections = Array.isArray(input.sections) ? [...new Set(input.sections.filter((s): s is SectionKey => typeof s === "string" && isSectionKey(s)))] : [];
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Give the report a name";
  if (!period) fieldErrors.period = "Choose a period";
  if (!sections.length) fieldErrors.sections = "Choose at least one section";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  const row = { name, period: period!, sections, shared: input.shared === true };
  const { data, error } = id ? await db.from("reports").update(row).eq("id", id).select("id").single() : await db.from("reports").insert(row).select("id").single();
  return error ? fail(error) : ok({ id: data.id });
}

export async function archiveReport(db: Db, id: string): Promise<ActionResult> {
  const { data, error } = await db.from("reports").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("Only the person who saved this report, or a principal, can remove it.");
  await db.from("report_schedules").update({ deleted_at: new Date().toISOString() }).eq("report_id", id).is("deleted_at", null);
  return ok(undefined);
}

export async function saveSchedule(
  db: Db,
  id: string | null,
  input: { target?: unknown; cadence?: unknown; recipient_ids?: unknown; active?: unknown },
): Promise<ActionResult<{ id: string }>> {
  const target = typeof input.target === "string" ? input.target : "";
  const pack = target.startsWith("pack:") ? target.slice(5) : null;
  const reportId = target.startsWith("report:") ? target.slice(7) : null;
  const cadence = input.cadence === "weekly" || input.cadence === "monthly" ? input.cadence : null;
  const recipients = Array.isArray(input.recipient_ids) ? [...new Set(input.recipient_ids.filter((r): r is string => typeof r === "string" && /^[0-9a-f-]{36}$/i.test(r)))] : [];
  const fieldErrors: Record<string, string> = {};
  if (!(pack && isPackKey(pack)) && !reportId) fieldErrors.target = "Choose a pack or saved report";
  if (!cadence) fieldErrors.cadence = "Choose how often";
  if (!recipients.length) fieldErrors.recipient_ids = "Choose at least one recipient";
  if (recipients.length > 20) fieldErrors.recipient_ids = "Up to 20 recipients";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  const row = { pack: pack && isPackKey(pack) ? pack : null, report_id: reportId, cadence: cadence!, recipient_ids: recipients, active: input.active !== false };
  const { data, error } = id
    ? await db.from("report_schedules").update(row).eq("id", id).select("id").single()
    : await db.from("report_schedules").insert(row).select("id").single();
  return error ? fail(error) : ok({ id: data.id });
}

export async function setScheduleActive(db: Db, id: string, active: boolean): Promise<ActionResult> {
  const { error } = await db.from("report_schedules").update({ active }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}

export async function archiveSchedule(db: Db, id: string): Promise<ActionResult> {
  const { error } = await db.from("report_schedules").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  return error ? fail(error) : ok(undefined);
}

/** When a schedule next fires (07:30 Dubai), for display. */
export function nextScheduleDate(cadence: string, today = todayDubai()) {
  if (cadence === "monthly") {
    const [y, m] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  }
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 Sun … 1 Mon
  return shiftDate(today, ((8 - dow) % 7) || 7);
}
