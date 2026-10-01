// Second layer behind RLS: strip fields tagged sensitive from anything a tool
// returns to the model, unless the caller is a principal. RLS already keeps
// these tables away from everyone else; this guards against a future view or
// join that accidentally carries one through.
const SENSITIVE = new Set([
  "iban",
  "iban_encrypted",
  "account_number",
  "swift",
  "salary",
  "basic_salary",
  "allowances",
  "compensation",
  "passport_no",
  "passport_number",
  "emirates_id",
  "visa_number",
  "token_hash",
]);

export function redact<T>(value: T, isPrincipal: boolean): T {
  if (isPrincipal) return value;
  return strip(value) as T;
}

function strip(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      if (SENSITIVE.has(k.toLowerCase())) continue;
      out[k] = strip(val);
    }
    return out;
  }
  return v;
}
