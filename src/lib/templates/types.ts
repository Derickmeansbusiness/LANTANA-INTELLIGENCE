/** A document as an ordered list of blocks, rendered to both PDF and DOCX. */
export type Block =
  | { kind: "title"; text: string; sub?: string }
  | { kind: "meta"; rows: [string, string][] }
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string }
  | { kind: "clause"; n: string; title: string; text: string }
  | { kind: "list"; items: string[]; numbered?: boolean }
  | { kind: "table"; head: string[]; rows: string[][]; align?: ("left" | "right")[] }
  | { kind: "signatures"; parties: { heading: string; name: string; title: string }[] }
  | { kind: "note"; text: string };

export type Field = {
  name: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
  /** Default value; "{today}" and "{signatory.name}" style tokens are filled on the server. */
  default?: string;
  wide?: boolean;
};

export type Company = { legal_name: string; licence_no: string | null; licensing_authority: string | null; address_lines: string[]; website: string | null };

export type InvoiceData = {
  invoice_no: string;
  kind: string;
  issue_date: string;
  due_date: string;
  currency: string;
  total: string;
  status: string;
  bill_to: string;
  bill_to_country: string | null;
  deal: string | null;
  /** Invoice lines, already formatted. Absent on older invoices recorded as a single total. */
  lines?: { description: string; quantity: string; unit_price: string; amount: string }[];
  subtotal?: string;
  vat?: { rate: string; amount: string } | null;
  reference?: string | null;
};

export type BuildContext = {
  company: Company;
  today: string;
  signatory: { name: string; title: string };
  invoice?: InvoiceData;
};

export type Template = {
  id: string;
  name: string;
  description: string;
  docType: "agreement" | "letter" | "certificate" | "invoice" | "resolution" | "proposal";
  confidentiality: "internal" | "confidential" | "restricted";
  fields: Field[];
  /** Set when the template can't be used yet; shown instead of the form. */
  unavailable?: string;
  /** Needs manager+ (and a record the caller can see). */
  managerOnly?: boolean;
  build: (v: Record<string, string>, ctx: BuildContext) => { title: string; blocks: Block[] };
};
