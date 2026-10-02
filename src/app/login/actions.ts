"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string } | undefined;

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

const passwordSchema = z.object({ email: emailSchema, password: z.string().min(8, "Password is at least 8 characters") });

export async function signInWithPassword(_: LoginState, form: FormData): Promise<LoginState> {
  const parsed = passwordSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "That email and password don't match." };
  redirect(safeNext(form.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Local development only: jump between the seeded test accounts. */
export async function devSwitchAccount(email: string) {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Dev login is disabled");
  }
  if (!/^[a-z]+@lantana\.test$/.test(email)) throw new Error("Not a test account");
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({ email, password: "lantana-dev-2026" });
  if (error) throw new Error(error.message);
  redirect("/");
}
