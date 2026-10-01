import "server-only";

/** Ask Lantana runs only when an API key is configured. */
export function agentAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export const CHAT_MODEL = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
/** Briefings and clause reviews run in the background of a page load: a faster model is fine. */
export const BACKGROUND_MODEL = () => process.env.ANTHROPIC_MODEL_BACKGROUND || process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

/**
 * Server-side fallback: if a safety classifier declines a request, the API
 * re-runs it on Anthropic's recommended fallback model inside the same call.
 */
export const fallbackParams = () => ({ betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const });

/** Hard stop on tool round-trips per user message. */
export const MAX_TOOL_ROUNDS = 8;
/** Proposals older than this can't be confirmed; the user asks again. */
export const PROPOSAL_TTL_HOURS = 24;
