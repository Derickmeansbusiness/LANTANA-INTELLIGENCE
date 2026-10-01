/** Shared by server pages and client components (no "use client" here). */

export function employeeStatusVariant(status: string) {
  if (status === "active") return "success" as const;
  if (status === "onboarding") return "info" as const;
  if (status === "offboarding") return "warning" as const;
  return "outline" as const;
}

export function leaveStatusVariant(status: string) {
  if (status === "approved") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "rejected") return "danger" as const;
  return "outline" as const;
}

export function payrollStatusVariant(status: string) {
  if (status === "paid") return "success" as const;
  if (status === "approved") return "info" as const;
  if (status === "void") return "outline" as const;
  return "default" as const;
}

export function wpsVariant(status: string) {
  if (status === "accepted") return "success" as const;
  if (status === "rejected") return "danger" as const;
  if (status === "submitted") return "info" as const;
  if (status === "not_required") return "outline" as const;
  return "warning" as const;
}
