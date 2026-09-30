# Lantana Command: build plan

Status: **approved 2026-09-29 ("approve all": every §10 question takes the recommended option).** Phase 1 is complete. Deviations found during the build are logged in `CLAUDE.md` → Decisions log.

This is my restatement of the brief. Where I changed something, I say what and why. Where the brief leaves a real decision open, I've listed it as a question and haven't guessed.

---

## 1. What we're building, in one paragraph

Lantana Command is a single-company internal OS for Lantana Vision FZ-LLC. It's one Next.js app on one Supabase Postgres database. Every permission rule lives in the database as RLS, so the UI, the API and the "Ask Lantana" agent all go through the same gate. It is **single-tenant on purpose**: one company, four roles. Multi-tenancy would put an `org_id` in every policy and every query, and nothing in the brief needs it. The external portal in Phase 6 is scoped grants on top of this model, not a second tenant.

---

## 2. Stack, and the places I'd deviate

| Layer | Choice | Note |
|---|---|---|
| Framework | **Next.js 16** (App Router, RSC, Server Actions), TypeScript strict | **Deviation, needs your OK.** The brief says 15. As of today npm has `latest = 16.3.7`, and 15 is on the `backport` tag (15.5.x), meaning maintenance only. Starting a multi-year internal system on the outgoing major buys us a forced migration within a year. The App Router model is the same, so nothing else in the plan changes. If you'd rather stay on 15, I'll pin `15.5.x`. |
| UI | Tailwind v4, shadcn/ui (Radix), lucide-react, Framer Motion | as briefed |
| Charts | Recharts, themed from CSS tokens | Tremor adds a second styling system for little gain |
| Tables | TanStack Table v8 | saved views are persisted in `saved_views` |
| Backend | Supabase: Postgres 17, Auth, Storage, RLS, Realtime, Edge Functions, pg_cron, pgvector, pgcrypto, Vault | |
| Validation | Zod on every server action and every agent tool input | the tool schema and the form schema are the same object |
| Types | `supabase gen types` → `src/lib/db/types.ts` | regenerated after each migration |
| Agent | Anthropic Messages API with tool use and streaming. Model from `ANTHROPIC_MODEL` | defaults to `claude-opus-5-5`. The briefing cron can use a cheaper model via `ANTHROPIC_MODEL_BACKGROUND` |
| Search | Postgres FTS (`tsvector`, generated columns) + pgvector | see embeddings question in §10 |
| Docs out | `docx` for Word, `@react-pdf/renderer` for PDF | one template definition renders both |
| Tests | Vitest (units, Zod, money math), pgTAP via `supabase test db` (RLS), Playwright (click-through, 375px + dark/light screenshots) | Chromium is already in this environment |
| Deploy | Vercel + Supabase | see region note below |

**Region.** Neither Supabase nor Vercel has a UAE region. The nearest pair that sits together is **Mumbai** (Supabase `ap-south-1`, Vercel `bom1`), about 30–40 ms from Dubai. Frankfurt is the fallback. What matters more than distance to the user is that the Vercel functions sit in the *same* region as the database, because one page can make 5–10 queries. Your existing Supabase projects are all in Stockholm/Frankfurt. I'd create a fresh one in Mumbai.

**Cost reality check** (per your "ask before paid" rule, flagged now so it doesn't surprise you later):
- **Vercel Hobby forbids commercial use.** A company's internal tool needs Pro (about $20/member/month). We can build and preview on Hobby, but production should be Pro.
- **Supabase Free** pauses after a week of inactivity and has no backups. All three of your current projects show `INACTIVE` for that reason, and the free org is capped at 2 active projects. For a system that holds contracts and payroll, Pro (about $25/month, daily backups, no pausing) is the minimum I'd go live on. Development can start on Free or locally.
- **Anthropic API** is pay-per-use. A realistic estimate for two principals with a daily briefing and moderate chat is tens of dollars a month, not hundreds. I'll add per-user token logging so you can see it.

---

## 3. Architecture

```
Browser ──► Next.js (Vercel, bom1)
             ├─ Server Components  ─► supabase client with the USER'S JWT ─► Postgres (RLS)
             ├─ Server Actions     ─► same client, Zod-validated          ─► Postgres (RLS)
             └─ /api/agent (stream)─► Claude API
                                        └─ tool calls ─► the same server functions ─► Postgres (RLS)
Supabase
  ├─ Postgres: tables, RLS, audit triggers, views, pgvector, pg_cron
  ├─ Storage: private buckets, signed URLs only
  ├─ Realtime: activity_events only (never the raw audit_log, see §5)
  └─ Edge Functions: daily briefing, nightly scan, weekly digest, doc ingestion
```

Rules I'll hold to:

1. **No service-role key in request paths.** Every user-facing read and write uses the user's session, so RLS is the real boundary. The service role is used only by cron jobs and ingestion, and those write only to tables whose visibility is decided by RLS on read.
2. **One domain layer.** `src/server/<module>/*.ts` holds functions like `createTask(input, ctx)`. Server actions call them. Agent tools call them. Nothing duplicates business logic.
3. **Agent writes are proposals.** A write tool never executes. It inserts an `agent_actions` row (`status = proposed`, with the payload and a computed before/after), and the UI renders a confirmation card. Confirm calls a server action that **re-checks permissions at execution time**, executes, and logs. That way a stale proposal can't outlive a role change.

---

## 4. Roles and permissions

Roles live in `profiles.role` (enum `principal | manager | staff | external`). RLS reads them through `security definer` helpers like `auth_role()` and `is_principal()`, so policies stay short and don't recurse.

| Data | Principal | Manager | Staff | External |
|---|---|---|---|---|
| Deals, orgs, contacts | all | all | deals they're assigned to + linked orgs | none |
| Introductions ledger | read + append | read + append | assigned deals, read | none |
| Tasks | all | all | own + tasks on assigned deals/projects | none |
| Documents | all | all | `confidentiality ≤ internal`, or explicitly shared | data rooms shared with them |
| Contracts | all | all | none (unless shared) | none |
| Employees (non-sensitive) | all | all | directory fields only | none |
| **Compensation / payroll** | all | **none** | **none** | none |
| **Bank accounts, balances, cash KPI** | all | **none** | none | none |
| Finance ledger, invoices | all | all except bank balances | none | none |
| Audit log (raw) | all | none | none | none |
| Activity feed | all | all | events on things they can see | none |

**Design decision: sensitive fields go in separate tables, not columns.** Postgres RLS works on rows, not columns. "Manager sees the employee but not the salary" is clean if salary lives in `employee_compensation` (principal-only policy) and messy if it's a column we try to hide. The same goes for `bank_accounts` and `employee_identity` (Emirates ID, passport, visa numbers).

**Encryption.** Supabase disks are already encrypted at rest. The brief asks for more, and I agree for these fields, because it protects against a leaked backup or a stray `select *` in a log. Salary amounts, IBANs and ID numbers are stored as `pgp_sym_encrypt(...)` with the key held in **Supabase Vault**. They're decrypted only inside `security definer` functions that check `is_principal()` first. One tradeoff: we can't `SUM()` encrypted salaries in SQL. Payroll totals are computed after decryption, inside the principal-only function. For a team of under 20 that costs nothing.

**MFA.** I recommend requiring TOTP for Principal accounts (Supabase Auth supports it natively, and RLS can check `aal2`). Anyone who can see payroll and bank data should have a second factor. Your call (§10).

**Testing it.** Each phase ships pgTAP tests that sign in as a seeded Staff user and assert zero rows from `employee_compensation`, `bank_accounts` and `payroll_items`, plus the same for Manager on the principal-only tables. Playwright repeats the check through the UI.

---

## 5. Audit log and activity feed

- `audit_log` is **append-only**: `insert` is granted to a trigger function only, and `update/delete` are revoked from every role, including `authenticated`. A generic `audit_trigger()` goes on every business table and records `actor, action, table, row_id, before jsonb, after jsonb, at`. Encrypted columns are written as `"[encrypted]"` and never as ciphertext.
- Things that aren't row mutations (download, share-link view, agent tool call, export, login) are logged by the server layer through `log_event()`.
- **Why the feed isn't the audit log:** the raw log contains before/after salary values for payroll edits. If the Command Center subscribed to it over Realtime, a Manager's browser would receive them. So there's a second table, `activity_events`, holding a human sentence ("Maimouna moved *Mauritania fertilizer* to Term sheet"), the entity reference and a visibility scope. RLS on that table mirrors RLS on the underlying entity. Realtime subscribes to this table only.
- **Introductions ledger is tamper-evident, not just append-only.** Each row stores `row_hash = sha256(prev_hash || canonical_json(row))`. Append-only stops casual edits. A hash chain lets you *prove* in a circumvention dispute that no entry was changed or back-dated after the fact, because breaking one row breaks every hash after it. The PDF export prints the chain head hash and the export timestamp in the footer.

---

## 6. Data model

Every business table gets `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` (trigger), `created_by uuid → profiles`, `deleted_at` (soft delete; RLS hides deleted rows by default), `is_demo boolean default false`, and RLS enabled with `force row level security`.

Money is `amount_minor bigint` + `currency char(3) → currencies`. The `currencies` table stores the ISO 4217 exponent, which matters here: **XAF has 0 decimal places**, AED/USD/EUR/NGN have 2, and TZS is officially 2 but is quoted in whole shillings in practice. Formatting and FX conversion always go through `src/lib/money.ts`, with unit tests.

Changes from the brief's list: `users`/`roles` become `profiles` + an enum (Supabase owns `auth.users`). I've added the tables marked ➕.

**Identity & org**
- `profiles`: 1:1 with `auth.users`, holds role, display name, avatar, contact link
- ➕ `company`: singleton row, legal name, licence no., address, letterhead assets
- ➕ `currencies`, ➕ `countries` (ISO codes, region `africa | gcc | other`, used by the map)

**Relationships**
- `organizations`: type (investor, project_owner, strategic_partner, introducer, government, supplier), country, sectors `text[]`, ticket range (min/max minor + currency), relationship owner, status, `last_contact_at`
- `contacts`: person, belongs to an org (nullable for individuals)
- `notes`: polymorphic (`entity_type`, `entity_id`)
- ➕ `interactions`: calls, meetings, emails logged against an org/contact (feeds the timeline and `last_contact_at`)

**Deals**
- `deals`: name, country, sector, ticket (minor + currency), project owner org, introducing partner org, fee terms (text + optional %), `spv_planned`, probability, stage, next step, owner
- ➕ `deal_parties`: M:N deal ↔ org with role (`investor_introduced`, `co_advisor`, …)
- ➕ `deal_members`: staff assigned to a deal (drives Staff RLS)
- `deal_stage_history`: every transition, written by trigger, so it can't be skipped
- `introductions`: append-only + hash chain (date, party A, party B, deal, channel, evidence document, notes)
- ➕ `pipeline_stages`: configurable list with order, default probability and `is_terminal`

**Work**
- `projects`, ➕ `milestones`, `tasks` (assignee, due, priority, status, recurrence rule, `source` = manual | agent | email | contract_obligation, polymorphic link), ➕ `task_dependencies`, ➕ `task_checklist_items`, `task_comments`

**Documents & contracts**
- `folders` (tree via `parent_id`), `tags`, ➕ `document_tags`
- `documents`: title, folder, type, confidentiality (`public | internal | confidential | restricted`), status (draft/signed), expiry, checked-out-by
- `document_versions`: storage path, size, sha256, uploaded_by. **Versions are immutable. A new upload means a new row.**
- ➕ `document_links`: M:N document ↔ deal/org/contract/employee (a signed NCNDA belongs to a deal *and* an org *and* a contract)
- `document_chunks`: version_id, ordinal, content, `tsvector`, `embedding vector(N)`
- ➕ `share_links`: token hash, expiry, watermark text, max views; ➕ `share_link_views`
- `contracts`: parties, type, effective date, term, renewal type, notice period days, governing law, forum, signatory, `signing_authority_confirmed`, status, e-sign status
- ➕ `contract_survival_clauses`: clause name + survival months (a contract can have several)
- `contract_obligations`: description, due date or rule, owner → generates a task

**People**
- `employees`: non-sensitive profile, reporting line, contract type, MOHRE no., visa / EID / labour-card **expiry dates** (the dates aren't secret, the numbers are)
- ➕ `employee_identity` (principal-only, encrypted numbers)
- ➕ `employee_compensation` (principal-only, encrypted, effective-dated)
- `leave_requests`, ➕ `leave_balances`, ➕ `checklists` / `checklist_items` (onboarding/offboarding)
- `payroll_runs`, `payroll_items` (principal-only)

**Finance**
- `accounts` (chart of accounts), ➕ `bank_accounts` (principal-only, masked IBAN), `transactions`, ➕ `transaction_attachments`
- `invoices`, `invoice_items`, `bills`, `budgets`, `fx_rates` (date, base, quote, rate, source)

**Compliance & governance**
- `compliance_items`: type, authority, due date, recurrence, owner, status (drives the calendar and expiry alerts)
- ➕ `corporate_records`: licence, shareholders, signatories, registered lease
- `meetings`, ➕ `resolutions`

**System**
- `notifications`, `saved_views`, `reports`, ➕ `report_schedules`
- `agent_threads` (optional pin to entity), `agent_messages`, `agent_actions` (proposed/confirmed/executed/rejected/failed, payload, before/after, executed_at), ➕ `agent_usage` (tokens per call)
- `audit_log`, ➕ `activity_events`
- ~~`kpi_snapshots`~~ **Changed in Phase 1:** KPIs are rebuilt from history (stage history, task completion, dated transactions), which respects RLS per viewer. The only gap is that ticket-size edits aren't versioned.
- ➕ `data_rooms`, ➕ `data_room_members`, ➕ `data_room_documents` (Phase 6)

**Views**
- `v_attention_queue`: a live `UNION ALL` over overdue tasks, contracts expiring ≤60 days, compliance due, unsigned docs, overdue invoices, stale deals. It's a view, not a nightly snapshot, so the queue is never a day out of date. The nightly scan only decides who gets *notified*.
- `v_pipeline_by_stage`, `v_weighted_forecast`, `v_upcoming_deadlines`

Full DDL is written in Phase 1 for everything Phases 1–2 touch, plus the minimal finance tables the KPI strip needs (`accounts`, `bank_accounts`, `transactions`, `fx_rates`). Later tables arrive in their own phase's migrations. **Migrations are additive only.** I'll ask before any migration that drops or rewrites data.

---

## 7. Design system

As briefed. The implementation specifics:

- Tokens live in `src/app/globals.css` as CSS variables under `@theme` (Tailwind v4). `.dark` is the default on `<html>`, and the light theme swaps the surface/text tokens. shadcn's `--primary`/`--ring` map to `--brand-gold`, and everything else maps to charcoal/sand/neutrals.
- Fonts: **Inter** (with `font-feature-settings: "tnum"` on a `.num` utility, used for all money and dates) and **Fraunces** for display headings only, both through `next/font` so there's no layout shift.
- The gold budget per screen: active nav item, primary button, focus ring, and the one hero number per card. If I catch gold used as a background fill, that's a bug.
- Shell: collapsible sidebar (icon rail below `lg`, sheet drawer below `md`), top bar with Cmd/Ctrl+K palette (`cmdk`), bell, "Ask Lantana", and a date-range picker whose state lives in the URL, so views are linkable.
- The map is pre-projected Natural Earth 1:110m paths for Africa + GCC, generated once by a build script with `d3-geo` and committed as a static SVG component. No GIS library ships to the browser, and it weighs about 60 KB.
- Motion: 150–200 ms ease-out. Cards fade up once on mount, numbers count up once, and all of it is disabled under `prefers-reduced-motion`.
- Timezone: every "today", every due-date comparison and every cron runs on **Asia/Dubai (UTC+4, no DST)**. The 07:30 briefing is therefore `30 3 * * *` UTC.

---

## 8. Ask Lantana (agent)

- `/api/agent` is a streaming route. The system prompt carries the role, current page, selected record and Dubai date. Tools are defined once with Zod and converted to JSON Schema for the API.
- **Read tools** run immediately and return records with IDs, so every figure in an answer links to its source row. **Write tools** return a proposal card instead of executing (§3). **External-facing tools** (`draft_email`, share, e-sign) only ever draft. Sending is a separate, explicit, logged confirm.
- **No delete tool exists.** `archive_record` sets `deleted_at` and goes through confirmation.
- **Sensitive data:** the tool layer runs under the user's JWT, so a Manager's agent physically can't read `employee_compensation`. As a second layer, a redaction pass strips any field tagged `sensitive` from tool output unless `is_principal()`.
- **Prompt injection:** counterparty drafts and uploaded documents are untrusted text. Document content is passed inside clearly delimited blocks with an instruction that it is data, and because every write needs a human click, a hostile clause in a PDF can't do anything on its own. This matters because `compare_contract_to_template` exists to read counterparties' documents.
- **Grounding:** `financial_summary` and `run_report` return numbers computed in SQL. The prompt forbids arithmetic on figures the tools didn't return, and when data is missing the tool returns an explicit `missing: [...]` that the model has to surface.
- **Scheduled jobs** (pg_cron → Edge Functions): daily briefing 07:30 Dubai for principals, nightly scan (overdue, expiring at 90/60/30/7 days, stale deals >14 days, unpaid invoices), and a Monday digest. These run with the service role, but they write `notifications` addressed to specific users, filtered by what each recipient's role can see.

---

## 9. Phases

Each phase ends with the same checks: `tsc --noEmit` and lint clean, pgTAP RLS tests pass, Playwright click-through at 375 px and desktop in both themes, audit rows verified for every mutation type, `CLAUDE.md` updated, then a short "works / stubbed" summary to you.

**Phase 1: Foundation**
Repo scaffold, tokens, fonts, layout shell, Cmd+K (navigation only; free text shows "Agent arrives in Phase 4"), Supabase project + migrations for the core schema, auth (magic link + seeded test users per role), RLS + helpers, audit trigger + `activity_events`, `kpi_snapshots` cron, full seed (§11), and a Command Center wired to real queries: KPI strip, funnel, attention queue, map, activity feed (Realtime), week strip. The briefing card renders a static placeholder labelled "Available in Phase 4".

**Phase 2: Deals, Partners, Tasks**
Deal kanban (dnd-kit) + table, deal record page with timeline, stage-change dialog, introductions ledger with hash chain + PDF export, weighted forecast chart. Org/contact directory and profile pages, interactions timeline, investor matcher (a scoring SQL function on sector ∩, country/region, ticket overlap; weights shown so it's explainable). Projects, milestones, tasks in list/board/calendar/timeline/"My day", recurring tasks. Saved views + CSV export on every table.

**Phase 3: Documents & Contracts**
Vault UI, drag-drop upload to private Storage, previews (PDF via pdf.js, DOCX via `docx-preview`, images, spreadsheets via SheetJS), versions, check-in/out, ingestion pipeline (extract → chunk → embed), hybrid search (FTS + vector, reciprocal-rank fusion), share links with watermark + view log. Letterhead templates (all 8) → DOCX + PDF. Contract register, survival clauses, obligations → tasks, 90/60/30/7 alerts.

**Phase 4: Ask Lantana**
Slide-over + `/agent`, streaming, threads (pinnable), all Phase 1–3 tools, confirmation cards, `compare_contract_to_template`, `generate_document`, daily briefing, nightly scan, Monday digest, usage logging. Cmd+K free text is routed to the agent.

**Phase 5: Finance, HR & Payroll, Compliance**
Chart of accounts, transactions, CSV import with agent-suggested categories (still confirmed by a human), invoices/bills with aging, budgets vs actuals, P&L / cash flow / runway, FX. Employees, leave, checklists, encrypted identity + compensation, payroll runs, WPS status, salary certificate from the actual payroll record only. Compliance calendar (only obligations you confirm), corporate records, minutes/resolutions. Finance/HR agent tools. Gmail/Calendar adapters (optional), e-sign adapter stub.

**Phase 6: Reports, polish, portal**
Report builder + saved/scheduled packs (PDF on letterhead, emailed Mondays), the 5 pre-built packs, chart PNG/CSV export. External data rooms with a separate portal layout and invite-only accounts. WCAG AA audit (axe in Playwright), performance pass, mobile pass, backup/export (JSON/CSV), production deploy.

---

## 10. Questions I need answered before Phase 1

1. **Next.js 16 instead of 15?** (§2) My recommendation is 16.
2. **Supabase project.** OK to create a new project "Lantana Command" in **Mumbai** on your existing org? Free tier to start. Your org already has 3 paused projects and Free allows 2 active, so one of them has to stay paused, or we upgrade to Pro. Or would you rather I build against a local Supabase in this container first? (I'd need to get Docker running here, which isn't guaranteed.)
3. **Embeddings for semantic search.** Anthropic doesn't offer an embeddings model, so this is a separate choice:
   - (a) **Supabase's built-in `gte-small`** running in an Edge Function: free, 384-dim, decent for English. My default.
   - (b) **Voyage AI** (`voyage-3.5`, paid per token, noticeably better on legal text and French). Worth it if a lot of your documents are in French, which is likely given Mauritania, Cameroon and the Francophone deals.
4. **OCR for scanned PDFs.** (a) Tesseract, free but mediocre on stamps and signatures, or (b) send scanned pages to Claude as PDF input, more accurate and billed as API usage. I'd do (b) only for pages with no text layer.
5. **MFA required for Principals?** I recommend yes.
6. **Login method.** Email magic link only, or also Google sign-in? Which email addresses should the two principal accounts use?
7. **Fai Shey Derick is both a principal and an individual introducer with an NCNDA.** I'll model this as one person with a `profiles` row and an `organizations` row of type introducer, linked together. Is that intended, and was the NCNDA signed before the principal role? It matters for how the introductions ledger attributes fees.
8. **Seed dates and amounts.** The brief gives parties and terms but not effective dates, ticket sizes or fee figures. Should I use plausible demo values marked `is_demo`, or give you a short table to fill in so even the demo is accurate?
9. **Finance demo numbers.** "Cash on hand" and "Monthly burn" need transactions. Demo figures (badged "Demo" in the UI), or leave those tiles empty until real data goes in?
10. **Compliance.** Per the brief, I won't invent obligations. Please confirm which apply: VAT registration (only mandatory above AED 375k taxable supplies), Corporate Tax registration + return (registration applies even to free-zone persons), RAKEZ licence renewal date, UBO register. My understanding is that ESR reporting was abolished for financial years starting after 2022, but please confirm with your accountant rather than relying on me.
11. **FX rates.** Manual daily entry, or an automatic feed? Worth knowing: AED is pegged to USD (3.6725) and XAF to EUR (655.957), so those two pairs never need a feed. TZS and NGN do, and the free ECB-based feeds don't cover them.
12. **Brand assets.** Please drop the logo as SVG (or a high-res PNG) and the letterhead DOCX into the repo, or send screenshots of lantanavision.com. I'll build with a text wordmark until then.
13. **Documents.** The actual PDFs for the seed documents (agreements, Mauritania letter, lease, 2025 presentation). Without them I'll seed metadata-only records that show "file not uploaded yet". I won't generate fake agreement text.

---

## 11. Seed data (all `is_demo = true`)

- **Company:** Lantana Vision FZ-LLC, licence FDCW2089, Compass Building, Al Shohada Road, Al Hamra Industrial Zone-FZ, Ras Al Khaimah, UAE. Licensed by RAKEZ.
- **Users:** Maimouna Baba Danpullo (Principal, Founder & MD), Fai Shey Derick (Principal, strategy & BD), plus two test accounts, `manager@demo` and `staff@demo`, which exist only for RLS testing and are removed by the wipe.
- **Organizations + agreements:**
  - PJM Advisory (TZ, origination partner, contact Patrick Joseph Muwowo). NCNDA, 2y + 2y survival, Tanzania courts, fees per project at SPV stage. ⚑ signing authority unconfirmed
  - Faminas Investment Group (investor, Africa-wide, non-exclusive). Mandate & Non-Circumvention, 1y auto-renew / 30-day notice, DIFC-LCIA, fees deal-by-deal. ⚑ signatory + address pending
  - Global Sphere (UAE fertilizer producer, strategic supply partner)
  - Fai Shey Derick (individual introducer). NCNDA, 2y + 2y survival, RAK courts
  - Ministry of Agriculture and Food Sovereignty, Mauritania (government, proposal sent)
- **Deals:** Mauritania fertilizer supply (urea/NPK/DAP) with Global Sphere; three Tanzania projects via PJM Advisory (two at *Introduced*, one at *Due diligence*); one Faminas-matched opportunity. Names, sectors and sizes come from your answer to Q8.
- **Documents:** the agreements above, the Mauritania letter, the RAKEZ co-working lease, the 2025 company presentation (metadata-only until Q13).
- The ⚑ flags become real attention-queue items, so the Command Center opens on day one showing the two open signing issues. They're genuinely the most important things in the seed.
- **Settings → "Wipe demo data"** deletes every `is_demo` row in dependency order, inside one transaction, after a typed confirmation. It's the one hard delete in the system, and it gets written to the audit log first.

---

## 12. Repo layout

```
src/
  app/(app)/            authenticated shell: command-center, deals, partners, tasks,
                        documents, contracts, people, finance, compliance, reports, settings, agent
  app/(portal)/         Phase 6 external data rooms
  app/api/agent/        streaming agent route
  components/ui/        shadcn primitives
  components/           shell, charts, tables, map, cards
  server/<module>/      domain functions (the only place that talks to the DB)
  server/agent/         tool registry, prompts, redaction
  lib/                  money, dates (Dubai), zod schemas, supabase clients
supabase/
  migrations/           numbered, additive
  seed.sql              demo data
  tests/                pgTAP RLS tests
  functions/            edge functions (briefing, scan, digest, ingest)
e2e/                    Playwright
CLAUDE.md  PLAN.md  .env.example
```
