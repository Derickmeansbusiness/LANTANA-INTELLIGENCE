import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/db/types";

export type Role = Database["public"]["Enums"]["user_role"];

export type SessionContext = {
  userId: string;
  email: string;
  fullName: string;
  title: string | null;
  role: Role;
  aal: "aal1" | "aal2";
  requirePrincipalMfa: boolean;
  /** Mirrors private.is_principal(): role principal AND (aal2 OR MFA not required). */
  isPrincipal: boolean;
  isManagerPlus: boolean;
};

/** Loads the session once per request. Redirects to /login when signed out. */
const loadSession = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) redirect("/login");

  const [{ data: profile }, { data: company }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, title, role, is_active").eq("id", claims.sub).maybeSingle(),
    supabase.from("company").select("require_principal_mfa").maybeSingle(),
  ]);

  if (!profile || !profile.is_active) redirect("/login?error=inactive");

  const aal = claims.aal === "aal2" ? "aal2" : "aal1";
  const requirePrincipalMfa = company?.require_principal_mfa ?? true;
  const isPrincipal = profile.role === "principal" && (aal === "aal2" || !requirePrincipalMfa);

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    title: profile.title,
    role: profile.role,
    aal,
    requirePrincipalMfa,
    isPrincipal,
    isManagerPlus: profile.role === "principal" || profile.role === "manager",
  };
});

export function needsMfa(s: SessionContext) {
  return s.role === "principal" && s.requirePrincipalMfa && s.aal !== "aal2";
}

/**
 * Who is signed in and what they effectively are. Sends a principal who
 * still has to pass TOTP to /mfa.
 */
export async function getSession(): Promise<SessionContext> {
  const s = await loadSession();
  if (needsMfa(s)) redirect("/mfa");
  return s;
}

/** Same as getSession but without the MFA redirect (used by /mfa itself). */
export const getSessionAllowMfaPending = loadSession;

export function firstName(full: string) {
  return full.split(/\s+/)[0] ?? full;
}
