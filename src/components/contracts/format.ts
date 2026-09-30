// Plain helpers shared by the server record page and client components.

export const statusVariant = (s: string) =>
  (s === "active" ? "success" : s === "awaiting_signature" || s === "negotiating" ? "info" : s === "draft" ? "outline" : "default") as "success" | "info" | "outline" | "default";

/** Colour for "days left": red inside a week, amber inside a month, gold inside 90 days. */
export const urgency = (days: number | null) => (days == null ? "" : days <= 7 ? "text-danger" : days <= 30 ? "text-warning" : days <= 90 ? "text-gold-ink" : "text-muted-foreground");
