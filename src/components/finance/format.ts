/** Shared by server pages and client components (no "use client" here). */

export function invoiceStatusVariant(status: string, aging?: string | null) {
  if (status === "paid") return "success" as const;
  if (status === "void") return "outline" as const;
  if (status === "draft") return "default" as const;
  return aging && aging !== "current" ? ("danger" as const) : ("info" as const);
}

export function billStatusVariant(status: string, aging?: string | null) {
  if (status === "paid") return "success" as const;
  if (status === "void") return "outline" as const;
  return aging && aging !== "current" ? ("danger" as const) : ("warning" as const);
}

export function agingLabel(bucket: string) {
  return bucket === "current" ? "Not yet due" : `${bucket} days overdue`;
}
