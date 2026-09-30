"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type WipeResult = { ok: true; counts: Record<string, number> } | { ok: false; error: string };

const confirmSchema = z.literal("WIPE DEMO DATA");

/** Principal-only; the database function enforces the role and logs the wipe. */
export async function wipeDemoData(confirm: string): Promise<WipeResult> {
  const parsed = confirmSchema.safeParse(confirm.trim());
  if (!parsed.success) return { ok: false, error: "Type WIPE DEMO DATA exactly to confirm." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("wipe_demo_data", { p_confirm: parsed.data });
  if (error) {
    return {
      ok: false,
      error: error.code === "42501" ? "Only a principal (with MFA verified) can wipe demo data." : `Wipe failed and nothing was deleted: ${error.message}`,
    };
  }
  revalidatePath("/", "layout");
  return { ok: true, counts: data as Record<string, number> };
}
