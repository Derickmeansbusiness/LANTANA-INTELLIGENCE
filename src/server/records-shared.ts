// Types and constants shared by the records server actions and their callers.
// Kept out of the "use server" file, which may only export async functions.

export type SearchHit = { entityType: string; entityId: string; title: string; subtitle: string };

export const RECORD_TYPES = ["deal", "organization", "contact", "task", "contract", "document", "compliance_item", "invoice"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export type RecordPreview = {
  type: RecordType;
  id: string;
  title: string;
  kicker: string;
  badges: { label: string; tone?: "gold" | "success" | "warning" | "danger" | "info" | "default" }[];
  fields: { label: string; value: string }[];
  notes?: string | null;
  lists?: { heading: string; items: string[] }[];
  fullPagePhase: number;
};

