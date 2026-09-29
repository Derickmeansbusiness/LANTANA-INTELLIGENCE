# CLAUDE.md: Lantana Command

Internal operating system for Lantana Vision FZ-LLC (RAKEZ, UAE). The full design is in `PLAN.md`. Read it first.

## Current status
- **Phase 0: planning.** `PLAN.md` is written and waiting for approval plus answers to its §10 questions. No code yet.

## Non-negotiables
- Build phase by phase (PLAN.md §9). Each phase must pass typecheck, lint, pgTAP RLS tests and the Playwright click-through (375px + desktop, light + dark) before the next one starts.
- RLS is the security boundary. Never use the service-role key in a user request path.
- Sensitive data (compensation, bank accounts, ID numbers) lives in separate principal-only tables, pgcrypto-encrypted, with the key in Supabase Vault.
- All business logic goes in `src/server/<module>`. Server actions and agent tools both call it.
- Agent write tools create `agent_actions` proposals. They execute only on user confirmation, re-checking permissions. There is no delete tool.
- Money is `bigint` minor units + ISO currency. Use `src/lib/money.ts`. XAF has 0 decimals.
- All dates and crons run on Asia/Dubai (UTC+4, no DST).
- Migrations are additive. Ask before anything that drops or rewrites data, and before adding any paid service.
- No lorem ipsum. Seed rows carry `is_demo = true`.
- Don't put model identifiers in commits or code comments. The model comes from `ANTHROPIC_MODEL`.

## Commands
_To be filled in during Phase 1._

## Decisions log
- Single-tenant (one company), not multi-tenant.
- `activity_events` (sanitized, RLS-scoped) feeds Realtime. The raw `audit_log` is principal-only and never streamed.
- The introductions ledger is append-only with a sha256 hash chain for tamper evidence.
- The attention queue is a live SQL view, not a nightly snapshot.
