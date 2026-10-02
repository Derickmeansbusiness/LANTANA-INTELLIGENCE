# Deploying Lantana Command

The app is a Next.js 16 server (Node 20+) in front of one Supabase project. Nothing else runs: there are no workers and no queues. Scheduled jobs are pg_cron inside Postgres. Below is what has to be true in production, in order. The sections marked **decision** need a person to choose and, where noted, to pay.

## 1. Supabase project

The hosted project already exists: `adrurfecdiobvyqdnalq` ("Lantana Command", Mumbai, ap-south-1).

1. **Migrations.** Apply every file in `supabase/migrations/` in name order: Supabase MCP `apply_migration` or `supabase db push`. CLAUDE.md lists what has been applied so far and what is still pending.
2. **PII key.** Migration `…0400_views_kpis` creates the `pii_key` secret in Supabase Vault when none exists. Never rotate or delete it. Doing so makes every encrypted identity number, pay figure and IBAN unreadable. Back it up somewhere offline that only the principals can open: run `select decrypted_secret from vault.decrypted_secrets where name = 'pii_key'` in the SQL editor.
3. **Auth settings** (Dashboard → Authentication):
   - **Site URL:** `https://<your domain>`
   - **Redirect URLs:** `https://<your domain>/auth/callback` and `https://<your domain>/auth/confirm`
   - **Allow new users to sign up: ON.** This looks wrong but is safe. The database trigger `private.handle_new_user()` refuses every new account that doesn't have an open invite, a dashboard invite or an administrator-set role. Turning sign-up off would also block invited guests, because they get their account on their first magic-link sign-in.
   - **Multi-factor: TOTP enabled.** Principals must pass it: `company.require_principal_mfa` is `true` on hosted.
   - **Email provider: custom SMTP (decision).** Supabase's built-in mailer only sends to members of the Supabase organisation, a few per hour. Magic links to staff and guests need a real SMTP sender. Two free options are a Google Workspace SMTP relay for `info@lantanavision.com` and Resend's free tier. Use whichever mailbox Lantana already pays for.
4. **Edge function `embed`** (semantic search) is already deployed with `verify_jwt: true`. Without it search still works, as keyword match.
5. **Backups (decision, paid).** The free tier has no point-in-time recovery and pauses after a week without traffic. For company records, Supabase Pro (about USD 25 a month) is the minimum. Until then, a principal should download the JSON backup from Settings → Backup and export every week.

## 2. Creating the first principals

Nobody can sign up uninvited, so the first two accounts are made by hand:

1. Dashboard → Authentication → Users → **Invite user** for each principal. The trigger accepts it (`invited_at` is set) and creates a `staff` profile.
2. SQL editor:
   ```sql
   update public.profiles set role = 'principal' where email in ('maimouna@…', 'fai@…');
   ```
3. Each principal signs in with the magic link and enrols TOTP at `/mfa`.

From then on, everyone is invited from **Settings → Invitations**. Principals can invite any role; managers can invite external guests only. Data-room guests are invited automatically when they are added to a room.

## 3. The Next.js server

**Hosting (decision, may be paid).** Any Node host works. On Vercel, the Hobby plan is for non-commercial use, so a company deployment needs Pro. Alternatives are a small container on Fly.io or Railway, or a VM running `pnpm build && pnpm start` behind a TLS proxy.

Environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://adrurfecdiobvyqdnalq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the project's publishable (anon) key |
| `NEXT_PUBLIC_SITE_URL` | `https://<your domain>` (used in magic links) |
| `NEXT_PUBLIC_ENABLE_DEV_LOGIN` | `false` (production ignores it anyway) |
| `ANTHROPIC_API_KEY` | optional; without it Ask Lantana, the AI briefing, clause review and OCR show as unavailable and the rule-based text is used |
| `ANTHROPIC_MODEL`, `ANTHROPIC_MODEL_BACKGROUND` | the chat and background model IDs |

On Vercel, `next.config.ts` falls back to the hosted project's URL and publishable key when the first two variables are missing (both are public values), and `NEXT_PUBLIC_SITE_URL` defaults to the project's production address (`VERCEL_PROJECT_PRODUCTION_URL`). Setting them explicitly still wins. Elsewhere they are required at build time, because `NEXT_PUBLIC_` values are compiled into the pages.

**Do not set the service-role or secret key on the web server.** No request path uses it. RLS under each user's own session is the security boundary.

Route handlers stream PDFs and the JSON backup, so allow responses of at least 60 s (`maxDuration` is set to 300 s on the backup and agent routes).

## 4. Scheduled jobs

All of these are pg_cron jobs in the database (UTC times; Dubai is UTC+4). They only write notifications.

| Job | When (Dubai) | What |
|---|---|---|
| `lantana-nightly-scan` | 06:45 daily | overdue tasks, stale deals, unpaid invoices |
| `lantana-expiry-alerts` | 07:15 daily | contract, document, licence and compliance dates at 90/60/30/7 days |
| `lantana-report-schedules` | 07:30 daily | weekly packs on Mondays, monthly on the 1st: a notification to each recipient |
| `lantana-weekly-digest` | 07:00 Mondays | everyone's week |

**Emailing the scheduled packs (decision).** Today a scheduled pack arrives as an in-app notification, and opening it builds the PDF under the reader's own access. To email the PDF on Mondays, the app needs an approved email API (the SMTP sender above can do it) and a small job that signs in as each recipient. Building a report as someone else would mean using the service-role key, which this design avoids.

## 5. Before go-live

- [ ] Wipe the demo data (Settings → Demo data, principal). On hosted, first apply the Phase 5 `wipe_demo_data()` from migration 1000 (see CLAUDE.md).
- [ ] Confirm the compliance items that apply (Compliance → Obligations); unconfirmed items drive no alerts.
- [ ] Enter the WPS employer and bank routing codes before the first payroll file, and confirm the SIF layout with the bank.
- [ ] Run `pnpm check` and `pnpm test:e2e` against a fresh local reset; all must pass.
- [ ] Download the first JSON backup and store it with the `pii_key` backup.
