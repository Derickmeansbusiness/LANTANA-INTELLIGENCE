// Plain helpers shared by the server record page and client components.

export const confVariant = (c: string) =>
  (c === "restricted" ? "danger" : c === "confidential" ? "warning" : c === "public" ? "success" : "outline") as "danger" | "warning" | "success" | "outline";

export function fmtSize(n: number | null | undefined) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
