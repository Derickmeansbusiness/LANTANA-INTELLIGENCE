export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

type PgError = { code?: string; message?: string } | null | undefined;

/** Turn a Postgres/PostgREST error into something a person can act on. */
export function fail(error: PgError | string, fallback = "Something went wrong. Try again."): { ok: false; error: string } {
  if (typeof error === "string") return { ok: false, error };
  const code = error?.code;
  const msg = error?.message ?? "";
  if (code === "42501") {
    // Our own guards raise 42501 with a readable message; RLS violations don't.
    return { ok: false, error: /row-level security|permission denied/i.test(msg) ? "You don't have permission to do that." : capitalise(msg) };
  }
  if (code === "22023" || code === "P0001") return { ok: false, error: capitalise(msg) };
  if (code === "23505") return { ok: false, error: "That already exists." };
  if (code === "23503") return { ok: false, error: "That links to a record that doesn't exist or you can't see." };
  if (code === "23514") return { ok: false, error: "Some values aren't allowed. Check the form." };
  return { ok: false, error: fallback };
}

function capitalise(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : s;
}

/** Zod issues → { field: message } for inline form errors. */
export function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "form");
    out[k] ??= i.message;
  }
  return out;
}
