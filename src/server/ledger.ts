import "server-only";
import type { Db } from "@/lib/supabase/server";

export type LedgerRow = {
  id: string;
  seq: number;
  introduced_on: string;
  channel: string;
  summary: string;
  party_a: string;
  party_a_contact: string | null;
  party_b: string;
  party_b_contact: string | null;
  deal_id: string | null;
  deal_name: string | null;
  corrects_id: string | null;
  corrects_seq: number | null;
  recorded_at: string;
  recorded_by: string | null;
  row_hash: string;
  prev_hash: string | null;
  is_demo: boolean;
};

export async function listIntroductions(db: Db, opts: { dealId?: string } = {}): Promise<LedgerRow[]> {
  let q = db
    .from("introductions")
    .select(
      "id, seq, introduced_on, channel, summary, deal_id, corrects_id, recorded_at, row_hash, prev_hash, is_demo, " +
        "a:organizations!introductions_party_a_org_id_fkey(name), b:organizations!introductions_party_b_org_id_fkey(name), " +
        "ac:contacts!introductions_party_a_contact_id_fkey(full_name), bc:contacts!introductions_party_b_contact_id_fkey(full_name), " +
        "deal:deals(name), recorder:profiles!introductions_recorded_by_fkey(full_name), corrected:corrects_id(seq)",
    )
    .order("seq", { ascending: true });
  if (opts.dealId) q = q.eq("deal_id", opts.dealId);
  const { data, error } = await q.returns<Raw[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    seq: r.seq,
    introduced_on: r.introduced_on,
    channel: r.channel,
    summary: r.summary,
    party_a: r.a?.name ?? "?",
    party_a_contact: r.ac?.full_name ?? null,
    party_b: r.b?.name ?? "?",
    party_b_contact: r.bc?.full_name ?? null,
    deal_id: r.deal_id,
    deal_name: r.deal?.name ?? null,
    corrects_id: r.corrects_id,
    corrects_seq: r.corrected?.seq ?? null,
    recorded_at: r.recorded_at,
    recorded_by: r.recorder?.full_name ?? null,
    row_hash: r.row_hash,
    prev_hash: r.prev_hash,
    is_demo: r.is_demo,
  }));
}

type Raw = {
  id: string;
  seq: number;
  introduced_on: string;
  channel: string;
  summary: string;
  deal_id: string | null;
  corrects_id: string | null;
  recorded_at: string;
  row_hash: string;
  prev_hash: string | null;
  is_demo: boolean;
  a: { name: string } | null;
  b: { name: string } | null;
  ac: { full_name: string } | null;
  bc: { full_name: string } | null;
  deal: { name: string } | null;
  recorder: { full_name: string } | null;
  corrected: { seq: number } | null;
};

export type ChainStatus = { ok: boolean; rows: number; firstBroken: number | null; head: string | null };

/** Null when the caller isn't allowed to verify (staff). */
export async function chainStatus(db: Db): Promise<{ real: ChainStatus; demo: ChainStatus } | null> {
  const [real, demo] = await Promise.all([
    db.rpc("verify_introductions_chain", { p_demo: false }),
    db.rpc("verify_introductions_chain", { p_demo: true }),
  ]);
  if (real.error || demo.error) return null;
  const shape = (r: { ok: boolean; rows_checked: number; first_broken_seq: number | null; head_hash: string | null }[] | null): ChainStatus => {
    const x = r?.[0];
    return { ok: x?.ok ?? true, rows: Number(x?.rows_checked ?? 0), firstBroken: x?.first_broken_seq ?? null, head: x?.head_hash ?? null };
  };
  return { real: shape(real.data), demo: shape(demo.data) };
}
