/**
 * Money is stored as integer minor units + ISO 4217 code. The exponent
 * differs by currency (XAF has 0 decimals), so never divide by 100 blindly.
 */
export const MINOR_UNITS: Record<string, number> = {
  AED: 2, USD: 2, EUR: 2, GBP: 2, SAR: 2, XAF: 0, XOF: 0, TZS: 2, NGN: 2, KES: 2, MRU: 2, ZAR: 2,
};

export function minorUnit(currency: string) {
  const m = MINOR_UNITS[currency];
  if (m === undefined) throw new Error(`Unknown currency ${currency}`);
  return m;
}

export function toMajor(amountMinor: number | bigint, currency: string): number {
  return Number(amountMinor) / 10 ** minorUnit(currency);
}

export function toMinor(amountMajor: number, currency: string): number {
  return Math.round(amountMajor * 10 ** minorUnit(currency));
}

/** Full precision, e.g. "USD 18,500,000.00" / "XAF 4,200,000,000". */
export function formatMoney(amountMajor: number, currency: string) {
  const digits = minorUnit(currency);
  return `${currency} ${amountMajor.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** Compact for tiles and charts, e.g. "$73.3M", "AED 56.9K". */
export function formatCompact(amountMajor: number | null | undefined, currency: string) {
  if (amountMajor === null || amountMajor === undefined || Number.isNaN(amountMajor)) return "—";
  const abs = Math.abs(amountMajor);
  const sign = amountMajor < 0 ? "−" : "";
  let body: string;
  if (abs >= 1e9) body = `${trim(abs / 1e9)}B`;
  else if (abs >= 1e6) body = `${trim(abs / 1e6)}M`;
  else if (abs >= 1e3) body = `${trim(abs / 1e3)}K`;
  else body = abs.toFixed(0);
  return currency === "USD" ? `${sign}$${body}` : `${sign}${currency} ${body}`;
}

function trim(n: number) {
  return n >= 100 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, "");
}
