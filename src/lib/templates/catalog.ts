import { fmtDate } from "@/lib/dates";
import type { Block, BuildContext, Field, Template } from "./types";

/*
 * Lantana's standard documents. Wording is a working template, not legal
 * advice: every generated file is saved as a draft for counsel to review.
 * Disputes default to DIAC arbitration: the DIFC-LCIA centre named in older
 * Lantana paperwork was abolished by Dubai Decree No. 34 of 2021.
 */

const LAW = "the laws of the United Arab Emirates as applied in the Emirate of Ras Al Khaimah";
const FORUM = "arbitration under the Arbitration Rules of the Dubai International Arbitration Centre (DIAC), seated in Dubai, in English, before a sole arbitrator";

const d = (iso: string | undefined) => (iso ? fmtDate(iso, "d MMMM yyyy") : "");
const lines = (s: string | undefined) =>
  (s ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean);

const lantanaParty = (c: BuildContext) =>
  `${c.company.legal_name}, a free zone limited liability company licensed by ${c.company.licensing_authority ?? "RAKEZ"}${
    c.company.licence_no ? ` under licence no. ${c.company.licence_no}` : ""
  }, of ${c.company.address_lines.join(", ")} ("Lantana")`;

const counterparty = (name: string, jurisdiction: string | undefined, address: string | undefined, short: string) =>
  `${name}${jurisdiction ? `, organised under the laws of ${jurisdiction}` : ""}${address ? `, of ${address}` : ""} ("${short}")`;

const signatory: Field[] = [
  { name: "signatory_name", label: "Signs for Lantana", type: "text", required: true, default: "{signatory.name}" },
  { name: "signatory_title", label: "Their title", type: "text", required: true, default: "{signatory.title}" },
];
const law: Field[] = [
  { name: "governing_law", label: "Governing law", type: "text", default: LAW, wide: true },
  { name: "forum", label: "Disputes", type: "textarea", default: FORUM, wide: true },
];
const cpFields = (who: string): Field[] => [
  { name: "cp_name", label: `${who} (legal name)`, type: "text", required: true, wide: true },
  { name: "cp_jurisdiction", label: "Incorporated in", type: "text", hint: "e.g. Tanzania" },
  { name: "cp_address", label: "Registered address", type: "text", hint: "Leave blank if not yet confirmed" },
  { name: "cp_signatory", label: "Their signatory", type: "text" },
  { name: "cp_title", label: "Signatory title", type: "text" },
];
const dateField: Field = { name: "date", label: "Date", type: "date", required: true, default: "{today}" };

const sigs = (v: Record<string, string>, cpHeading: string) =>
  ({
    kind: "signatures",
    parties: [
      { heading: "For Lantana Vision FZ-LLC", name: v.signatory_name, title: v.signatory_title },
      { heading: `For ${cpHeading}`, name: v.cp_signatory || "", title: v.cp_title || "" },
    ],
  }) satisfies Block;

export const TEMPLATES: Template[] = [
  {
    id: "ncnda",
    name: "NCNDA",
    description: "Mutual non-circumvention and non-disclosure agreement, for any party before introductions start.",
    docType: "agreement",
    confidentiality: "confidential",
    fields: [
      dateField,
      ...cpFields("Counterparty"),
      { name: "purpose", label: "Purpose", type: "textarea", wide: true, default: "evaluating and pursuing investment, trade and project opportunities in Africa and the GCC that either party introduces to the other" },
      { name: "term_years", label: "Term (years)", type: "number", default: "5" },
      ...signatory,
      ...law,
    ],
    build: (v, c) => {
      const short = "Counterparty";
      return {
        title: `NCNDA — ${v.cp_name}`,
        blocks: [
          { kind: "title", text: "Non-Circumvention and Non-Disclosure Agreement" },
          { kind: "meta", rows: [["Date", d(v.date)]] },
          { kind: "para", text: `This agreement is made between ${lantanaParty(c)} and ${counterparty(v.cp_name, v.cp_jurisdiction, v.cp_address, short)}, each a "Party".` },
          { kind: "clause", n: "1", title: "Purpose", text: `The Parties intend to share information and introduce contacts to each other for the purpose of ${v.purpose} (the "Purpose").` },
          { kind: "clause", n: "2", title: "Confidential Information", text: "Confidential Information means any non-public information disclosed by one Party to the other in any form, including the identity and details of investors, project owners, principals, intermediaries, financial terms and documents. It excludes information that is public through no breach of this agreement, was lawfully known to the recipient beforehand, or is independently developed." },
          { kind: "clause", n: "3", title: "Non-disclosure", text: "Each Party shall use the other's Confidential Information only for the Purpose, keep it confidential, and disclose it only to its officers, employees and professional advisers who need to know it and are bound by equivalent obligations. Disclosure required by law or a competent authority is permitted after prompt notice to the other Party where lawful." },
          { kind: "clause", n: "4", title: "Non-circumvention", text: "Neither Party shall, directly or indirectly, contact, deal with, or enter into any transaction with any person introduced by the other Party in connection with the Purpose, nor bypass the introducing Party, without the introducing Party's prior written consent. Each introduction is recorded in writing with its date." },
          { kind: "clause", n: "5", title: "Fees on circumvention", text: "If a Party breaches clause 4 and a transaction results, the breaching Party shall pay the introducing Party the fee it would have earned on that transaction under any agreement between them, or, if none, a reasonable fee in line with market practice, without prejudice to other remedies." },
          { kind: "clause", n: "6", title: "Term", text: `This agreement lasts ${v.term_years || "5"} years from its date. Obligations regarding Confidential Information and introductions made during the term survive for that period.` },
          { kind: "clause", n: "7", title: "No obligation", text: "Nothing in this agreement obliges either Party to proceed with any transaction, creates a partnership or agency, or grants any licence." },
          { kind: "clause", n: "8", title: "Governing law and disputes", text: `This agreement is governed by ${v.governing_law || LAW}. Any dispute shall be finally resolved by ${v.forum || FORUM}.` },
          { kind: "clause", n: "9", title: "Entire agreement", text: "This agreement is the entire agreement on its subject and may be amended only in writing signed by both Parties. It may be signed in counterparts and electronically." },
          sigs(v, v.cp_name),
        ],
      };
    },
  },
  {
    id: "mandate",
    name: "Mandate & Non-Circumvention",
    description: "Engages Lantana to raise capital or find partners for a client, with fees and survival.",
    docType: "agreement",
    confidentiality: "confidential",
    fields: [
      dateField,
      ...cpFields("Client"),
      { name: "scope", label: "Mandate", type: "textarea", required: true, wide: true, hint: "What Lantana is engaged to do, e.g. identify and introduce GCC investors for the project" },
      { name: "exclusivity", label: "Exclusivity", type: "select", default: "non-exclusive", options: [{ value: "non-exclusive", label: "Non-exclusive" }, { value: "exclusive", label: "Exclusive" }] },
      { name: "success_fee", label: "Success fee (% of funds closed)", type: "number", required: true, default: "3" },
      { name: "retainer", label: "Retainer", type: "text", hint: "e.g. USD 5,000 per month. Leave blank for none." },
      { name: "term_months", label: "Term (months)", type: "number", default: "12" },
      { name: "survival_months", label: "Survival after termination (months)", type: "number", default: "24" },
      ...signatory,
      ...law,
    ],
    build: (v, c) => ({
      title: `Mandate & Non-Circumvention Agreement — ${v.cp_name}`,
      blocks: [
        { kind: "title", text: "Mandate and Non-Circumvention Agreement" },
        { kind: "meta", rows: [["Date", d(v.date)]] },
        { kind: "para", text: `This agreement is made between ${lantanaParty(c)} and ${counterparty(v.cp_name, v.cp_jurisdiction, v.cp_address, "Client")}.` },
        { kind: "clause", n: "1", title: "Mandate", text: `The Client appoints Lantana on a ${v.exclusivity === "exclusive" ? "exclusive" : "non-exclusive"} basis to ${v.scope.replace(/\.$/, "")} (the "Mandate").` },
        { kind: "clause", n: "2", title: "Lantana's role", text: "Lantana acts as an adviser and introducer. It does not hold client money, give regulated investment advice, or bind the Client. Each introduction is confirmed in writing with its date and recorded in Lantana's introductions register." },
        { kind: "clause", n: "3", title: "Fees", text: `On financial close of any transaction with a party introduced by Lantana, the Client shall pay Lantana a success fee of ${v.success_fee}% of the funds committed, payable within 10 business days of close.${v.retainer ? ` The Client shall also pay a retainer of ${v.retainer}, invoiced in advance and not credited against the success fee unless agreed in writing.` : ""} Fees are exclusive of VAT, which is added where applicable.` },
        { kind: "clause", n: "4", title: "Non-circumvention", text: "The Client shall not, directly or through others, approach, negotiate or transact with any party introduced by Lantana other than through Lantana, and shall inform Lantana promptly of any direct approach by such a party." },
        { kind: "clause", n: "5", title: "Confidentiality", text: "Each party shall keep the other's non-public information confidential and use it only for the Mandate, save as required by law." },
        { kind: "clause", n: "6", title: "Term and termination", text: `The Mandate lasts ${v.term_months || "12"} months from its date and may be terminated by either party on 30 days' written notice.` },
        { kind: "clause", n: "7", title: "Survival", text: `Clauses 3, 4 and 5 survive for ${v.survival_months || "24"} months after termination or expiry: a transaction closed in that period with a party Lantana introduced during the Mandate earns the success fee.` },
        { kind: "clause", n: "8", title: "Governing law and disputes", text: `This agreement is governed by ${v.governing_law || LAW}. Any dispute shall be finally resolved by ${v.forum || FORUM}.` },
        { kind: "clause", n: "9", title: "General", text: "This is the entire agreement on its subject. Amendments must be in writing and signed by both parties. It may be signed in counterparts and electronically." },
        sigs(v, v.cp_name),
      ],
    }),
  },
  {
    id: "salary_certificate",
    name: "Salary Certificate",
    description: "Confirms an employee's position and pay, addressed to a bank or embassy.",
    docType: "certificate",
    confidentiality: "restricted",
    unavailable: "Available once payroll is live (Phase 5). A salary certificate may only be generated from an actual payroll record, never typed in.",
    fields: [],
    build: () => ({ title: "Salary certificate", blocks: [] }),
  },
  {
    id: "loi",
    name: "Letter of Intent",
    description: "Non-binding letter setting out proposed terms for an investment or supply.",
    docType: "letter",
    confidentiality: "confidential",
    fields: [
      dateField,
      { name: "addressee", label: "Addressed to (name)", type: "text", required: true },
      { name: "addressee_org", label: "Organization", type: "text", required: true },
      { name: "addressee_address", label: "Address", type: "text" },
      { name: "project", label: "Project", type: "text", required: true, wide: true },
      { name: "amount", label: "Proposed amount", type: "text", hint: "e.g. USD 25,000,000" },
      { name: "terms", label: "Proposed terms", type: "textarea", required: true, wide: true, hint: "One term per line" },
      { name: "conditions", label: "Conditions", type: "textarea", wide: true, hint: "One per line, e.g. satisfactory due diligence" },
      { name: "valid_until", label: "Valid until", type: "date" },
      ...signatory,
    ],
    build: (v) => ({
      title: `Letter of Intent — ${v.project}`,
      blocks: [
        { kind: "meta", rows: [["Date", d(v.date)], ["To", [v.addressee, v.addressee_org, v.addressee_address].filter(Boolean).join(", ")]] },
        { kind: "title", text: "Letter of Intent", sub: v.project },
        { kind: "para", text: `Dear ${v.addressee},` },
        { kind: "para", text: `We write to confirm our intention to proceed with ${v.project}${v.amount ? `, for an amount of ${v.amount}` : ""}, on the principal terms below.` },
        { kind: "heading", text: "Proposed terms" },
        { kind: "list", items: lines(v.terms), numbered: true },
        ...(lines(v.conditions).length ? ([{ kind: "heading", text: "Conditions" }, { kind: "list", items: lines(v.conditions) }] as Block[]) : []),
        { kind: "heading", text: "Status of this letter" },
        { kind: "para", text: `This letter is an expression of intent only and is not legally binding, except that the parties shall keep its contents confidential. Binding obligations arise only under definitive agreements signed by both parties.${v.valid_until ? ` This letter lapses if not countersigned by ${d(v.valid_until)}.` : ""}` },
        { kind: "para", text: "Yours sincerely," },
        { kind: "signatures", parties: [{ heading: "For Lantana Vision FZ-LLC", name: v.signatory_name, title: v.signatory_title }, { heading: `Acknowledged for ${v.addressee_org}`, name: v.addressee, title: "" }] },
      ],
    }),
  },
  {
    id: "engagement_letter",
    name: "Engagement Letter",
    description: "Sets out an advisory engagement: scope, deliverables, fees and term.",
    docType: "letter",
    confidentiality: "confidential",
    fields: [
      dateField,
      { name: "cp_name", label: "Client (legal name)", type: "text", required: true, wide: true },
      { name: "client_contact", label: "Client contact", type: "text", required: true },
      { name: "cp_address", label: "Client address", type: "text" },
      { name: "scope", label: "Scope of work", type: "textarea", required: true, wide: true, hint: "One item per line" },
      { name: "deliverables", label: "Deliverables", type: "textarea", wide: true, hint: "One per line" },
      { name: "fees", label: "Fees", type: "textarea", required: true, wide: true, hint: "e.g. AED 40,000, 50% on signature and 50% on delivery" },
      { name: "term", label: "Timing", type: "text", default: "Six weeks from signature" },
      ...signatory,
      ...law,
    ],
    build: (v, c) => ({
      title: `Engagement Letter — ${v.cp_name}`,
      blocks: [
        { kind: "meta", rows: [["Date", d(v.date)], ["To", [v.client_contact, v.cp_name, v.cp_address].filter(Boolean).join(", ")]] },
        { kind: "title", text: "Engagement Letter" },
        { kind: "para", text: `Dear ${v.client_contact},` },
        { kind: "para", text: `Thank you for choosing ${c.company.legal_name}. This letter sets out the terms on which we will act for ${v.cp_name}.` },
        { kind: "heading", text: "Scope" },
        { kind: "list", items: lines(v.scope) },
        ...(lines(v.deliverables).length ? ([{ kind: "heading", text: "Deliverables" }, { kind: "list", items: lines(v.deliverables) }] as Block[]) : []),
        { kind: "heading", text: "Fees and expenses" },
        { kind: "para", text: `${v.fees.trim().replace(/\.?$/, ".")} Fees exclude VAT, added where applicable. Pre-approved travel and third-party costs are re-billed at cost. Invoices are payable within 14 days.` },
        { kind: "heading", text: "Timing" },
        { kind: "para", text: v.term || "As agreed in writing." },
        { kind: "heading", text: "Terms" },
        { kind: "para", text: `We act as advisers and do not provide legal, tax or regulated investment advice. Each party keeps the other's non-public information confidential. Either party may end the engagement on 14 days' written notice; fees for work done to that date remain payable. This letter is governed by ${v.governing_law || LAW}, and disputes are resolved by ${v.forum || FORUM}.` },
        { kind: "para", text: "Please countersign to confirm your agreement." },
        { kind: "signatures", parties: [{ heading: "For Lantana Vision FZ-LLC", name: v.signatory_name, title: v.signatory_title }, { heading: `Agreed for ${v.cp_name}`, name: v.client_contact, title: "" }] },
      ],
    }),
  },
  {
    id: "invoice",
    name: "Invoice",
    description: "Prints an invoice already recorded in Finance. Amounts come from the record, never typed here.",
    docType: "invoice",
    confidentiality: "confidential",
    managerOnly: true,
    fields: [
      { name: "invoice_id", label: "Invoice", type: "select", required: true, wide: true, options: [] },
      { name: "notes", label: "Notes on the invoice", type: "textarea", wide: true, hint: "Optional, e.g. purchase order reference" },
    ],
    build: (v, c) => {
      const inv = c.invoice!;
      return {
        title: `Invoice ${inv.invoice_no}`,
        blocks: [
          { kind: "title", text: "Invoice", sub: inv.invoice_no },
          {
            kind: "meta",
            rows: [
              ["Bill to", [inv.bill_to, inv.bill_to_country].filter(Boolean).join(", ")],
              ["Issue date", d(inv.issue_date)],
              ["Due date", d(inv.due_date)],
              ...(inv.deal ? ([["Deal", inv.deal]] as [string, string][]) : []),
            ],
          },
          {
            kind: "table",
            head: ["Description", "Amount"],
            align: ["left", "right"],
            rows: [
              [`${inv.kind === "success_fee" ? "Success fee" : inv.kind === "retainer" ? "Retainer" : inv.kind === "advisory" ? "Advisory services" : "Services"}${inv.deal ? ` — ${inv.deal}` : ""}`, inv.total],
              ["Total due", inv.total],
            ],
          },
          ...(v.notes ? ([{ kind: "para", text: v.notes }] as Block[]) : []),
          { kind: "note", text: `Please quote ${inv.invoice_no} with your payment. Bank details are confirmed separately by a Lantana principal; never act on changed bank details received by email alone.` },
        ],
      };
    },
  },
  {
    id: "board_resolution",
    name: "Board Resolution",
    description: "Written resolution of the directors of Lantana Vision FZ-LLC.",
    docType: "resolution",
    confidentiality: "restricted",
    managerOnly: true,
    fields: [
      dateField,
      { name: "place", label: "Place", type: "text", default: "Ras Al Khaimah, United Arab Emirates" },
      { name: "subject", label: "Subject", type: "text", required: true, wide: true, hint: "e.g. Opening of a corporate bank account" },
      { name: "recitals", label: "Background", type: "textarea", wide: true },
      { name: "resolutions", label: "Resolutions", type: "textarea", required: true, wide: true, hint: "One resolution per line" },
      { name: "directors", label: "Directors signing", type: "textarea", required: true, wide: true, hint: "One per line: Name, title" },
    ],
    build: (v, c) => ({
      title: `Board Resolution — ${v.subject}`,
      blocks: [
        { kind: "title", text: "Written Resolution of the Board of Directors", sub: c.company.legal_name },
        { kind: "meta", rows: [["Date", d(v.date)], ["Place", v.place], ["Licence", `${c.company.licensing_authority ?? "RAKEZ"} ${c.company.licence_no ?? ""}`.trim()], ["Subject", v.subject]] },
        ...(v.recitals ? ([{ kind: "heading", text: "Background" }, { kind: "para", text: v.recitals }] as Block[]) : []),
        { kind: "heading", text: "It is resolved that" },
        { kind: "list", items: lines(v.resolutions), numbered: true },
        { kind: "para", text: "This resolution is passed in writing by the directors named below and is as valid as if passed at a duly convened meeting. It may be signed in counterparts." },
        {
          kind: "signatures",
          parties: lines(v.directors).map((l) => {
            const [name, ...t] = l.split(",");
            return { heading: "Director", name: name.trim(), title: t.join(",").trim() };
          }),
        },
      ],
    }),
  },
  {
    id: "proposal",
    name: "Proposal",
    description: "Advisory or project proposal on letterhead, for a client or a government.",
    docType: "proposal",
    confidentiality: "internal",
    fields: [
      dateField,
      { name: "addressee", label: "Addressed to", type: "text", required: true },
      { name: "addressee_org", label: "Organization", type: "text", required: true },
      { name: "title", label: "Proposal title", type: "text", required: true, wide: true },
      { name: "summary", label: "Summary", type: "textarea", required: true, wide: true },
      { name: "scope", label: "Scope", type: "textarea", wide: true, hint: "One item per line" },
      { name: "timeline", label: "Timeline", type: "textarea", wide: true, hint: "One milestone per line" },
      { name: "fees", label: "Commercial terms", type: "textarea", wide: true },
      { name: "validity_days", label: "Valid for (days)", type: "number", default: "30" },
      ...signatory,
    ],
    build: (v) => ({
      title: `Proposal — ${v.title}`,
      blocks: [
        { kind: "meta", rows: [["Date", d(v.date)], ["To", `${v.addressee}, ${v.addressee_org}`]] },
        { kind: "title", text: v.title, sub: `Proposal to ${v.addressee_org}` },
        { kind: "heading", text: "Summary" },
        { kind: "para", text: v.summary },
        ...(lines(v.scope).length ? ([{ kind: "heading", text: "Scope" }, { kind: "list", items: lines(v.scope) }] as Block[]) : []),
        ...(lines(v.timeline).length ? ([{ kind: "heading", text: "Timeline" }, { kind: "list", items: lines(v.timeline), numbered: true }] as Block[]) : []),
        ...(v.fees ? ([{ kind: "heading", text: "Commercial terms" }, { kind: "para", text: v.fees }] as Block[]) : []),
        { kind: "note", text: `This proposal is valid for ${v.validity_days || "30"} days from its date and is confidential to ${v.addressee_org}.` },
        { kind: "signatures", parties: [{ heading: "For Lantana Vision FZ-LLC", name: v.signatory_name, title: v.signatory_title }] },
      ],
    }),
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

/** Validate submitted values against a template's fields. Returns errors keyed by field. */
export function checkValues(t: Template, raw: Record<string, unknown>) {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const f of t.fields) {
    const v = typeof raw[f.name] === "string" ? (raw[f.name] as string).trim().slice(0, f.type === "textarea" ? 6000 : 400) : "";
    if (f.required && !v) errors[f.name] = "Required";
    if (v && f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[f.name] = "Use a valid date";
    if (v && f.type === "number" && !(Number(v) >= 0 && Number(v) <= 1000)) errors[f.name] = "Enter a number";
    if (v && f.type === "select" && f.options?.length && !f.options.some((o) => o.value === v)) errors[f.name] = "Choose an option";
    values[f.name] = v;
  }
  return { values, errors };
}
