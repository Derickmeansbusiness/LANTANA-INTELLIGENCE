import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/**
 * Supabase client bound to the signed-in user's session. Every query runs
 * under their JWT, so RLS decides what comes back. This is the only client
 * request paths may use.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

export type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Same user, no cookies: for work scheduled with after(), once the response
 * (and its cookie store) is gone. Pass the access token read during the request.
 */
export function createTokenClient(accessToken: string) {
  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * No user at all (role anon). Used only by the public share-link route, which
 * can do exactly two things: call open_share_link() and read the one object
 * that call just opened (storage policy lantana_docs_share_read).
 */
export function createAnonClient() {
  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
