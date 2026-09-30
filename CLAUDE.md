@AGENTS.md

# CLAUDE.md: Lantana Command

Internal operating system for Lantana Vision FZ-LLC (RAKEZ, UAE). The full design is in `PLAN.md`. Read it first.

## Current status
- **Phase 1 (Foundation): done.** Schema, RLS, audit, seed, auth + MFA, shell, Ctrl+K, Command Center, Settings.
- **Phase 2 (Deals, Partners, Tasks): done.** Deal board/table/forecast + record page (matcher, parties, team, notes, timeline), introductions ledger + dated PDF, partner directory + profiles + interactions, tasks (My day, list, board, calendar, timeline, projects), checklists, comments, dependencies, recurring tasks, saved views, CSV export.
- **Next: Phase 3** (Documents vault, uploads, previews, templates on letterhead, contract register, semantic search).
- Module pages for Phases 3–6 are placeholders (`src/components/module-page.tsx`). Bump `CURRENT_PHASE` in `src/components/shell/nav.ts` when a phase ships.

## Environments
- **Local:** Supabase in Docker (`pnpm db:start`). Next dev on :3000.
- **Hosted:** Supabase project `adrurfecdiobvyqdnalq` ("Lantana Command", ap-south-1 Mumbai, free tier). Schema only: no seed, no users yet. Principal MFA is required there.
- Migrations reach the hosted project through the Supabase MCP `apply_migration` (the CLI can't reach Postgres from the cloud dev container). Keep `supabase/migrations/*` the source of truth and apply each new file there in order.

## Commands
```bash
pnpm db:start      # local Supabase (images from docker.io; the default ECR registry is blocked here)
pnpm db:reset      # re-apply migrations + seed/00_dev_users.sql + seed/10_demo_data.sql
pnpm db:test       # pgTAP: RLS per role, MFA gating, audit immutability, hash chain, demo wipe
pnpm db:types      # regenerate src/lib/db/types.ts after a migration
pnpm dev           # http://localhost:3000
pnpm typecheck     # next typegen && tsc --noEmit
pnpm lint
pnpm test          # vitest (money, dates)
pnpm test:e2e      # Playwright: 3 roles, 1440px + 375px, dark + light
pnpm check         # typecheck + lint + unit + pgTAP
pnpm map:build     # regenerate the Africa+GCC SVG paths
node scripts/smoke.mjs <email> /path …   # sign in as a test user, open pages, report errors (SHOT=dir for screenshots)
node scripts/fetch-as.mjs <email> /path out   # authenticated GET, e.g. the ledger PDF
```
Reset the DB before `pnpm test:e2e`: the Phase 2 specs create records (names carry `E2E_RUN`).
Cloud container notes: start Docker with `dockerd &` first. Playwright uses `/opt/pw-browsers/chromium-1194` automatically. Don't `pkill -f "next dev"` from a shell whose command line contains that string (it kills the shell).

Local logins (password `lantana-dev-2026`): `maimouna@`, `fai@` (principals), `manager@`, `staff@` `lantana.test`. The user menu can switch between them when `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true`.

## Non-negotiables
- Build phase by phase (PLAN.md §9). Each phase must pass typecheck, lint, pgTAP RLS tests and the Playwright click-through (375px + desktop, light + dark) before the next one starts.
- RLS is the security boundary. Never use the service-role key in a user request path.
- Sensitive data (compensation, bank accounts, ID numbers) lives in separate principal-only tables, pgcrypto-encrypted, with the key in Supabase Vault (`private.pii_key()`).
- All business logic goes in `src/server/<module>`. Server actions and agent tools both call it.
- Agent write tools create `agent_actions` proposals. They execute only on user confirmation, re-checking permissions. There is no delete tool.
- Money is `bigint` minor units + ISO currency. Use `src/lib/money.ts`. XAF has 0 decimals.
- All dates and crons run on Asia/Dubai (UTC+4, no DST). Use `src/lib/dates.ts` / `private.today_dubai()`.
- Migrations are additive. Ask before anything that drops or rewrites data, and before adding any paid service.
- No lorem ipsum. Seed rows carry `is_demo = true`.
- Don't put model identifiers in commits or code comments. The model comes from `ANTHROPIC_MODEL`.

## Conventions
- **DB:** helpers live in the `private` schema (not exposed). Every business table has `is_demo`, `created_by default auth.uid()`, `deleted_at`, an `audit_row()` trigger and RLS. No DELETE policies on business records. The exceptions are link/preference rows (`deal_members`, `deal_parties`, `task_dependencies`, `task_checklist_items`, `saved_views`), which are still audited. SELECT policies don't filter `deleted_at` (that breaks `UPDATE … RETURNING` on soft delete), so queries and views filter it. `private.guard_archive()` stops anyone below manager from setting `deleted_at` (task/comment/note/interaction creators may archive their own).
- **Domain layer:** `src/server/{deals,partners,relationships,tasks,ledger}.ts` take the caller's `Db` client and return `ActionResult` (`src/lib/action-result.ts`). `src/server/actions/*` are thin `"use server"` wrappers that add `revalidatePath`. Zod schemas in `src/lib/schemas/*` are shared by forms and the server.
- **PostgREST embeds:** hint with the FK constraint name (`profiles!deals_owner_id_fkey`), except self-references, which embed by column (`corrected:corrects_id(seq)`).
- **Roles:** `private.is_principal()` = role principal AND (aal2 OR `company.require_principal_mfa` false). A principal at aal1 gets manager-level access. `private.is_manager_plus()`, `private.is_internal()`, `private.can_see_deal()`, `private.can_see_org()`.
- **Views/RPCs** used by the UI are `security_invoker`, so they return only what the caller may see. The exceptions (`SECURITY DEFINER`, callable by signed-in users) check the role themselves: `log_event`, `set_user_role`, `wipe_demo_data`, `set/reveal_bank_account_iban`, `private.kpi_burn_aed`. The Supabase advisor flags these; that's expected.
- **Seeds/imports** can backdate events with `set_config('app.occurred_at', …)`; `private.event_time()` reads it.
- **UI:** shadcn-style components are hand-written in `src/components/ui` (the shadcn registry is blocked from this container). Tokens are in `src/app/globals.css`. Gold is an accent only. Use the `num` utility for money and dates. Grid children need `min-w-0` (Card has it by default) or long text blows out mobile layouts.
- **Records:** any record opens in the side sheet via `?record=<type>:<uuid>` (`src/components/shell/record-sheet.tsx`). Tasks open the editable `TaskSheet` via `?task=<uuid>` (or `?record=task:<uuid>`). Deals and organizations have full pages.
- **Tables:** use `src/components/data-table/data-table.tsx` (TanStack Table **v8**, pinned; v9 has a different API). It gives search, facets, sorting, column visibility, saved views and CSV export (UTF-8 BOM, formula-injection safe).
- **PDFs:** `@react-pdf/renderer`, letterhead in `src/server/pdf/letterhead.tsx`. Standard fonts only draw WinAnsi characters, so pass text through `pdfText()`. Hyphenation is off.
- **Not found:** `src/app/(app)/not-found.tsx` covers both "doesn't exist" and "RLS hides it" on purpose. Status is 200 because `loading.tsx` starts streaming first; tests assert on content.
- **Server actions:** `"use server"` files may only export async functions. Shared types go in a sibling module (e.g. `src/server/records-shared.ts`).
- **Next.js 16:** `proxy.ts` (not middleware), async `params`/`searchParams`/`cookies()`. Bundled docs are in `node_modules/next/dist/docs/`.

## Decisions log
- Next.js 16 instead of 15 (15 is backport-only). Approved.
- Single-tenant (one company), not multi-tenant.
- `activity_events` (sanitized, RLS-scoped) feeds Realtime. The raw `audit_log` is principal-only and never streamed.
- The introductions ledger is append-only with a sha256 hash chain. Demo and real rows chain separately so the demo wipe leaves the real chain verifiable. Corrections are new rows with `corrects_id`.
- The attention queue is a live SQL view, not a nightly snapshot.
- KPI sparklines are rebuilt from history (stage history, task completion, dated transactions) instead of a `kpi_snapshots` table, so they respect RLS per viewer. Known approximation: ticket-size edits aren't versioned.
- Monthly burn is visible to managers in aggregate (payroll included). Individual payroll rows and bank balances are principal-only.
- Compliance items are seeded as `unconfirmed` and only surface as "confirm whether this applies". Nothing drives alerts until a principal confirms it.
- The Faminas mandate names DIFC-LCIA as forum. That centre was abolished by Dubai Decree No. 34 of 2021 (cases moved to DIAC). This is flagged in the contract notes for counsel.
- Embeddings: Supabase built-in `gte-small` (free). OCR: Claude only for pages with no text layer. Both Phase 3.
- The morning briefing is rule-based until Phase 4 and says so in the UI.
- Closing a deal (won/lost) requires a reason; `move_deal_stage()` writes it onto the stage-history row.
- The investor matcher is deliberately simple and explainable: sector 40, geography 30, ticket 30, with the reasons returned.
- Introductions chain verification is `SECURITY DEFINER` and manager+ only, because it must read rows staff can't see.
- A task can't be marked done while a task it depends on is open (enforced in `src/server/tasks.ts`).
- Tasks only have due dates, so the timeline shows task dots, not bars. We don't invent start dates.
