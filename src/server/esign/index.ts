import "server-only";
import type { Db } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { ESIGN_STATUSES } from "@/lib/schemas/contracts";

/**
 * E-signature adapter. Lantana Command doesn't send anything for signature
 * itself yet: the only provider is "manual", which records the status a
 * person reports (sent, viewed, signed…) on the contract. A paid provider
 * (DocuSign, Adobe Sign, Zoho Sign, UAE Pass) plugs in by implementing
 * EsignProvider; it needs the principals' approval first, because it is a
 * paid service and it sends documents outside Lantana.
 */
export type EsignStatus = (typeof ESIGN_STATUSES)[number];

export type EsignProvider = {
  id: string;
  label: string;
  /** Send the contract's linked document for signature. Returns the provider's envelope id. */
  send(db: Db, contractId: string, signers: { name: string; email: string }[]): Promise<ActionResult<{ envelopeId: string | null }>>;
  /** Current status, from the provider or from what a person recorded. */
  status(db: Db, contractId: string): Promise<ActionResult<{ status: EsignStatus | null }>>;
};

const manual: EsignProvider = {
  id: "manual",
  label: "Recorded by hand",
  async send() {
    return fail("No e-signature service is connected. Send the PDF yourself and record the status on the contract.");
  },
  async status(db, contractId) {
    const { data, error } = await db.from("contracts").select("esign_status").eq("id", contractId).maybeSingle();
    if (error) return fail(error);
    if (!data) return fail("Contract not found.");
    return ok({ status: (data.esign_status as EsignStatus | null) ?? null });
  },
};

const PROVIDERS: Record<string, EsignProvider> = { manual };

/** The configured provider (ESIGN_PROVIDER), falling back to manual. */
export function esignProvider(): EsignProvider {
  return PROVIDERS[process.env.ESIGN_PROVIDER ?? "manual"] ?? manual;
}
