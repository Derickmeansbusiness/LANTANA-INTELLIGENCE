/**
 * Report catalog: the sections a report can contain, the five built-in packs,
 * and reporting periods. Pure data; the server computes each section under
 * the reader's own session, so nobody gets a pack showing more than they see.
 */

export const SECTIONS = {
  headline: { label: "Headline figures", description: "Pipeline, advanced deals, capital introduced, burn and overdue tasks; cash for principals." },
  attention: { label: "Needs attention", description: "The top items from the attention queue." },
  pipeline: { label: "Pipeline by stage", description: "Open deals and value per stage, weighted by probability." },
  stage_moves: { label: "Deal movements", description: "Stage changes in the period, including deals won and lost." },
  introductions: { label: "Introductions", description: "Introductions recorded in the ledger in the period." },
  tasks: { label: "Tasks", description: "Overdue, completed in the period, and due in the next 7 days." },
  pnl: { label: "Profit and loss", description: "Income and costs by account for the period, in AED." },
  cash: { label: "Cash and runway", description: "Cash on hand and runway. Principals only; never saved to the vault." },
  receivables: { label: "Owed to and by Lantana", description: "Open invoices and bills by age." },
  budget: { label: "Budget vs actual", description: "Last full month against budget." },
  contracts: { label: "Contract dates", description: "Terms ending, notice deadlines and survival periods in the next 90 days." },
  compliance: { label: "Compliance", description: "Confirmed deadlines in the next 90 days and items awaiting confirmation." },
  people: { label: "People", description: "Headcount, leave in the next 30 days and document expiries in the next 60." },
} as const;

export type SectionKey = keyof typeof SECTIONS;
export const SECTION_KEYS = Object.keys(SECTIONS) as SectionKey[];

/** Sections that may only ever be shown to an MFA-verified principal and are never written to the vault. */
export const PRINCIPAL_ONLY: SectionKey[] = ["cash"];

export const PERIODS = {
  last_7: "Last 7 days",
  last_30: "Last 30 days",
  month_to_date: "Month to date",
  last_month: "Last month",
  quarter_to_date: "Quarter to date",
  year_to_date: "Year to date",
} as const;
export type PeriodKey = keyof typeof PERIODS;

export const PACKS = {
  weekly_management: {
    name: "Weekly management pack",
    description: "What moved this week and what needs a decision. Sent on Mondays.",
    period: "last_7",
    sections: ["headline", "attention", "pipeline", "stage_moves", "tasks", "cash", "compliance"],
  },
  monthly_board: {
    name: "Monthly board pack",
    description: "Last month for the board: deals, introductions, results, cash, contracts and compliance.",
    period: "last_month",
    sections: ["headline", "pipeline", "stage_moves", "introductions", "pnl", "cash", "receivables", "budget", "contracts", "compliance", "people"],
  },
  pipeline: {
    name: "Pipeline and introductions",
    description: "Where every deal stands and who was introduced to whom.",
    period: "last_30",
    sections: ["pipeline", "stage_moves", "introductions"],
  },
  finance: {
    name: "Finance pack",
    description: "Results, money owed both ways, budget and cash.",
    period: "last_month",
    sections: ["pnl", "receivables", "budget", "cash"],
  },
  people_compliance: {
    name: "People and compliance",
    description: "The team, leave, visa and ID expiries, licences and filings.",
    period: "last_30",
    sections: ["people", "compliance", "contracts"],
  },
} as const satisfies Record<string, { name: string; description: string; period: PeriodKey; sections: readonly SectionKey[] }>;

export type PackKey = keyof typeof PACKS;
export const PACK_KEYS = Object.keys(PACKS) as PackKey[];

const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
};

/** Inclusive date range for a period, relative to `today` (Dubai date). */
export function periodRange(period: PeriodKey, today: string): { from: string; to: string; label: string } {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const d = Number(today.slice(8, 10));
  const back = (days: number) => iso(y, m, d - days);
  switch (period) {
    case "last_7":
      return { from: back(6), to: today, label: PERIODS[period] };
    case "last_30":
      return { from: back(29), to: today, label: PERIODS[period] };
    case "month_to_date":
      return { from: iso(y, m, 1), to: today, label: PERIODS[period] };
    case "last_month":
      return { from: iso(y, m - 1, 1), to: iso(y, m, 0), label: PERIODS[period] };
    case "quarter_to_date": {
      const q = Math.floor((m - 1) / 3) * 3 + 1;
      return { from: iso(y, q, 1), to: today, label: PERIODS[period] };
    }
    case "year_to_date":
      return { from: iso(y, 1, 1), to: today, label: PERIODS[period] };
  }
}

export function isSectionKey(s: string): s is SectionKey {
  return s in SECTIONS;
}
export function isPackKey(s: string): s is PackKey {
  return s in PACKS;
}
export function isPeriodKey(s: string): s is PeriodKey {
  return s in PERIODS;
}

/** Sections allowed in a vault copy (which managers can open). */
export function vaultSafeSections(sections: readonly SectionKey[]) {
  return sections.filter((s) => !PRINCIPAL_ONLY.includes(s));
}
