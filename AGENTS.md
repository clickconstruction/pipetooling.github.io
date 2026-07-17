# AI Agent Instructions

> **Start here.** Then read [docs/AI_CONTEXT.md](./docs/AI_CONTEXT.md) for the project overview and [docs/README.md](./docs/README.md) for the full documentation index. This file stays minimal: login, constraints, and drift recovery only. Per-feature detail lives in [docs/RECENT_FEATURES.md](./docs/RECENT_FEATURES.md) — grep it, don't duplicate it here.

---

## Quick Orientation

**PipeTooling** — Workflow management for master plumbers. React + TypeScript + Supabase, deployed to GitHub Pages. 9 user roles, 4 major systems (Projects/Workflows, Bids, Materials, Checklist) plus significant subsystems (Jobs, Estimates, Banking, People/Payroll, Prospects, Schedule Dispatch, Documents, Map). ~234 tables, all with RLS. ~58 Edge Functions.

---

## Logging in as an agent — password-free dev login

**Need an authenticated session to run, test, or verify the app? Do NOT stop at the email/password screen.** In local dev there is a built-in password-free login:

1. Start the app: `npm run dev` (use the port Vite actually prints — usually `5173`).
2. Navigate the browser to `http://localhost:<port>/dev-login?as=<existing-email>&to=/<path>`
   - Example: `http://localhost:5173/dev-login?as=robert@douglasmining.com&to=/settings`
   - `as=` must be an email that exists in `auth.users`; `to=` is where to land after login (defaults to `/dashboard`).
3. It auto-fires on page load (no clicks) — mints a magic link via the `dev-login` Edge Function and drops you onto the app authenticated.

**Requirements:** `VITE_DEV_LOGIN_SECRET` in `.env.local` (already set locally) + server-side `DEV_LOGIN_SECRET`.
**Safety:** dev-only — gated on `import.meta.env.DEV`; production builds redirect `/dev-login` → sign-in.
**Full details:** [`docs/EDGE_FUNCTIONS.md`](./docs/EDGE_FUNCTIONS.md) → dev-login · frontend [`src/pages/DevLogin.tsx`](./src/pages/DevLogin.tsx), function [`supabase/functions/dev-login/index.ts`](./supabase/functions/dev-login/index.ts).

---

## Where to Look For...

Full index: [docs/README.md](./docs/README.md). Fast pointers for the most common agent needs:

| Need | Go to |
|---|---|
| Database schema, tables, columns | `docs/PROJECT_DOCUMENTATION.md` → Database Schema; generated types `src/types/database.ts` |
| Role permissions (9 roles) | `docs/ACCESS_CONTROL.md` (authoritative) |
| Adding a new role | `docs/ADDING_A_NEW_ROLE.md` |
| Term definitions / feature names | `docs/GLOSSARY.md` |
| History of any feature or surface | grep `docs/RECENT_FEATURES.md` (append-only changelog, one `v2.NNN` entry per PR) |
| Migration history + baseline squash story | `docs/MIGRATIONS.md`; drift check: `npm run check:migration-drift` |
| Edge Functions reference | `docs/EDGE_FUNCTIONS.md`; drift check: `npm run check:edge-drift` |
| Bids system / decomposing Bids.tsx | `docs/BIDS_SYSTEM.md` / `docs/BIDS_TABS_ARCHITECTURE.md` |
| Decomposing a large page (god components) | `docs/PAGE_DECOMPOSITION_PLAYBOOK.md`, then the per-page architecture map |
| Salaried clock/schedule sync behavior | `docs/SALARY_CLOCK_SESSIONS.md` |
| Company timezone rules | `docs/TIME_AND_ZONES.md`; constant `APP_CALENDAR_TZ` in `src/utils/dateUtils.ts`; `npm run check:timezone` |
| App crash / outage / Supabase load | `docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md` → `docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md`; capture: `scripts/capture-supabase-incident.sh` |
| White screen, RPC 404, sign-in issues | `docs/TROUBLESHOOTING.md` |
| SPA reload / deep-link 404 mechanics | `src/lib/hardReload.ts` + `index.html` |
| User-facing help guides | `src/content/help/*.md` (ship with features — see `CLAUDE.md`) |

---

## Critical Constraints (Non-Negotiable)

1. **Never edit existing migrations** — append-only; create a new migration to change schema.
   - **Create migration files with the CLI**: `supabase migration new short_description` (snake_case). Never invent timestamps or reuse a `YYYYMMDDHHMMSS` prefix (one version → one file). **Number from `origin/main`'s latest file** (`git ls-tree origin/main supabase/migrations/ | tail`), not your branch.
   - **Apply ONLY with `supabase db push`, and only after the file is on `main` (or in the PR merging right now).** Never apply DDL via MCP `apply_migration`, `execute_sql`, or the Dashboard SQL editor — all three caused the drift that forced the 2026-07-04 full ledger rewrite. See `CLAUDE.md` for the full rule.
   - **A version is immutable once applied to prod — never renumber.** CI rejects duplicates/malformed names (`scripts/check-migrations.sh`); alignment check: `npm run check:migration-drift`.
   - **CI never applies migrations** — merging deploys only the client. For coupled changes, deploy the client first, then push the migration. Write idempotent DDL (`IF NOT EXISTS`, `CREATE OR REPLACE`). There is no staging — migrations hit prod.
   - **Migrations that CREATE TABLE must end with BOTH `SELECT public.apply_read_only_write_blocks();` and `SELECT public.apply_read_only_stmt_blocks();`** (read-only training-mode RLS + statement trigger — see `CLAUDE.md`).
2. **Always add RLS policies** — every new table needs SELECT/INSERT/UPDATE/DELETE coverage for all 9 roles.
3. **Update types after schema changes** — `npm run gen-types:local` or `npm run gen-types:linked` (regenerates `src/types/database.ts`; manual: `supabase gen types typescript --local > src/types/database.ts`).
4. **No `any` types** — TypeScript strict mode. Use proper types or `unknown`.
5. **Wrap Supabase calls** — `withSupabaseRetry()` from `@/utils/errorHandling`.
6. **Test all 9 roles** — dev, master_technician, assistant, controller (assistant-like + payroll access), subcontractor, helpers (UI "Helper"), estimator, primary, superintendent.
7. **Company time zone** — use `APP_CALENDAR_TZ` from `src/utils/dateUtils.ts` (Edge: `supabase/functions/_shared/appTimeZone.ts`); no new `'America/Chicago'` literals (`npm run check:timezone`).
8. **Realtime subscriptions** — use `useRealtimeChannel` from `src/hooks/useRealtimeChannel.ts` for every `postgres_changes` listener; filter server-side via the `filter` string; don't add tables to the `supabase_realtime` publication casually.
9. **Branch + PR workflow** — `main` is branch-protected. Branch → PR (`gh pr create --fill`) → CI `checks` (typecheck + lint + test) green → squash-merge. Run `npm run typecheck && npm run lint && npm test && npm run build` locally first. Never `git add -A` — stage specific files (parallel sessions leave WIP in the tree).
10. **Theme tokens, not raw hexes** — use CSS variables from `src/index.css`; CI fails on raw neutral hexes (`node scripts/theme-tokenize.mjs --check src`).
11. **Docs ship with the PR** — `docs/RECENT_FEATURES.md` entry (next `v2.NNN`), plus the matching specialist doc and help guide when the change warrants it (see `CLAUDE.md` → Working conventions). Do **not** append feature detail to this file, `docs/AI_CONTEXT.md`, or `docs/README.md`.

---

## Migration history drift (linked project)

First: `npm run check:migration-drift` (CI runs it daily). If it reports drift, read the DB-migrations rule in `CLAUDE.md` before touching anything — the ledger was fully rewritten on 2026-07-04 (backup at `supabase_migrations._schema_migrations_backup_20260704`) and careless repairs re-create that mess.

Inspect with `supabase migration list --linked`; every applied version should appear in both Local and Remote columns.

Break-glass repairs (understand what happened before running either):
- **Remote-only version** (ledger row with no repo file): `supabase migration repair --status reverted VERSION --linked` — edits the history table only; it does not run DOWN or drop objects.
- **Push fails "already exists"** (DDL applied but never recorded): `supabase migration repair --status applied VERSION --linked`, then `supabase db push --linked` (add `--include-all` for out-of-order timestamps).

If an emergency ever forces MCP `apply_migration`: immediately rename the new ledger row's `version`/`name` to match the repo filename in the same session (see `CLAUDE.md`).

---

## Supabase MCP

The Supabase MCP server (when available) is for **read/inspect operations**: `list_tables`, `list_migrations`, `execute_sql` for read-only queries, `get_logs`, `get_advisors`. Do **not** use MCP `apply_migration` or `execute_sql` for DDL — apply migrations only via `supabase db push` per `CLAUDE.md`. Edge functions may be deployed via MCP `deploy_edge_function` or `supabase functions deploy <name>`.

---

## Next Steps

1. Read [docs/AI_CONTEXT.md](./docs/AI_CONTEXT.md) — overview, file map, patterns, glossary
2. Open the specialist doc for your task ([docs/README.md](./docs/README.md) index)
3. Review code — `src/pages/` for UI, `supabase/` for backend
4. Grep [docs/RECENT_FEATURES.md](./docs/RECENT_FEATURES.md) for the history of the surface you're changing
5. Ask before changing when requirements are unclear

---

*This file stays minimal — feature detail belongs in `docs/RECENT_FEATURES.md` and the specialist docs.*

last_updated: 2026-07-17
