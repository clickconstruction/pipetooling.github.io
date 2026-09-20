# AI Agent Instructions

> **Start here.** Then [docs/AI_CONTEXT.md](./docs/AI_CONTEXT.md) for the project overview and [docs/README.md](./docs/README.md) for the documentation index. This file holds what an agent needs before its first command: login, the two write roles, where to look, the non-negotiable constraints, and migration-ledger repair. The hard rules themselves live in [CLAUDE.md](./CLAUDE.md); per-feature history lives in `docs/recent-features/` (one fragment per PR) — grep it, don't duplicate it here. When something on this page changes, amend the line that holds it (`CLAUDE.md` → *Amend, don't add*).

---

## Quick orientation

**PipeTooling** — workflow management for master plumbers. React + TypeScript + Supabase, deployed to GitHub Pages. 9 user roles; four major systems (Projects/Workflows, Bids, Materials, Checklist) plus Jobs, Estimates, Banking, People/Payroll, Prospects, Schedule Dispatch, Documents, Map. ~394 tables, all with RLS; ~121 Edge Functions.

---

## Logging in as an agent — password-free dev login

**Need an authenticated session to run, test, or verify the app? Do not stop at the email/password screen.** Local dev has a built-in login:

1. Start the app: `npm run dev` (use the port Vite prints — usually `5173`; any port works, so parallel sessions run on 5174/5177/…).
2. Open `http://localhost:<port>/dev-login?as=1&to=/<path>` — e.g. `http://localhost:5173/dev-login?as=1&to=/settings`. It fires on page load: mints a magic link via the `dev-login` Edge Function, verifies the token on the current origin, and lands on `to=` (default `/dashboard`).
3. The identity is fixed: dev login **always signs in as `robert@douglasmining.com`** (`as=` only triggers it). That is a **prod account on prod data** — verify read-only unless the task is a write.

**Requirements:** `VITE_DEV_LOGIN_SECRET` in `.env.local` + server-side `DEV_LOGIN_SECRET`. **Safety:** gated on `import.meta.env.DEV`; production builds redirect `/dev-login` → sign-in. Details: [`docs/EDGE_FUNCTIONS.md`](./docs/EDGE_FUNCTIONS.md) → dev-login · [`src/pages/DevLogin.tsx`](./src/pages/DevLogin.tsx) · [`supabase/functions/dev-login/index.ts`](./supabase/functions/dev-login/index.ts).

## Writing to the database as an agent — two least-privilege roles

Agent work that writes records goes through one of two Postgres roles, each scoped to one job and one validated RPC — **use them instead of `postgres`/service-role**, which bypass every guard. Both connect through the session pooler (`user=<role>.yewfzhbofbbyvkvtaatw`) with credentials only in `.env.local` (`HR_AGENT_DB_PASSWORD`, `COST_AGENT_DB_PASSWORD`); RLS binds them like any user; dry-run first and plan in a human-readable file. The conventions are in each contract doc.

| Role | What it may do | Entrypoint | Contract |
|---|---|---|---|
| `hr_agent` | HR-file entries, a person's summary/narrative, exhibit metadata (People → HR, dev-only) | `public.hr_agent_write(jsonb)` | [`docs/HR_FILES.md`](./docs/HR_FILES.md) |
| `cost_agent` | Move job cost as a recorded, reversible batch — bank allocations, supply-house invoice allocations, clock sessions, `ESTIMATE` charges, thread notes | `public.cost_batch_apply(jsonb, dry_run)` / `public.cost_batch_revert(uuid, text)` | [`docs/COST_BATCHES.md`](./docs/COST_BATCHES.md) |

---

## Where to look for…

Full index: [docs/README.md](./docs/README.md). The fast pointers:

| Need | Go to |
|---|---|
| Unfinished, hand-off-ready projects | [`to-dos/README.md`](./to-dos/README.md) — one file per project (ask, decision, mock-up, plan, verify recipe). The in-app Punch list (`/punch-list`) is rendered from each to-do's front matter at build time (`npm run check:todos` in CI): change the to-do file; nothing generated is committed. |
| Database schema, tables, columns | `docs/PROJECT_DOCUMENTATION.md` → Database Schema; generated types `src/types/database.ts` |
| Role permissions (9 roles) / adding a role | `docs/ACCESS_CONTROL.md` (authoritative) / `docs/ADDING_A_NEW_ROLE.md` |
| Term definitions / feature names | `docs/GLOSSARY.md` |
| History of any feature or surface | grep `docs/recent-features/` (one `v2.NNNN.md` per PR since 2026-08-20) and the frozen `docs/RECENT_FEATURES.md` |
| Migration history / ledger alignment | `docs/MIGRATIONS.md` + `docs/migrations/`; `npm run check:migration-drift` |
| Edge Functions reference | `docs/EDGE_FUNCTIONS.md`; `npm run check:edge-drift` |
| Digital twins (the robots) and the MCP servers an agent connects through | `docs/twins/HANDOFF.md` (state + operation), `docs/EDGE_FUNCTIONS.md` → twin-mcp (every verb), `docs/dev-mcp/README.md` (the dev server: read the app as yourself, GET-only), `to-dos/mcp-servers.md` (addresses, naming, what is left) |
| Bids system | `docs/BIDS_SYSTEM.md`; the maps start at `docs/BIDS_TABS_ARCHITECTURE.md` |
| Decomposing a large page | `docs/PAGE_DECOMPOSITION_PLAYBOOK.md`, then the per-page architecture map |
| Salaried clock/schedule sync | `docs/SALARY_CLOCK_SESSIONS.md` |
| Company timezone rules | `docs/TIME_AND_ZONES.md`; `APP_CALENDAR_TZ` in `src/utils/dateUtils.ts`; `npm run check:timezone` |
| App looks down / crash / Supabase load | `docs/DB_FREEZE_RUNBOOK.md` first (lock pileup vs instance stall — before any restart), then `docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md` → `docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md`; capture with `scripts/capture-supabase-incident.sh` |
| White screen, RPC 404, sign-in issues | `docs/TROUBLESHOOTING.md` |
| SPA reload / deep-link 404 mechanics | `src/lib/hardReload.ts` + `index.html` |
| User-facing help guides | `src/content/help/*.md` (ship with features — `CLAUDE.md`) |

---

## Critical constraints (non-negotiable)

1. **Migrations**: append-only; created with `supabase migration new <snake_case>` (never invent or reuse a timestamp — a version is immutable once applied); numbered from `origin/main`; opened with `SET lock_timeout = '3s';`; applied only by `supabase db push` after the file is on `main`; CREATE TABLE closed with both read-only block calls. The full rule: `CLAUDE.md` → DB migrations. CI never applies migrations. The Supabase MCP is for reads (`list_tables`, `list_migrations`, read-only `execute_sql`, logs, advisors) — never `apply_migration`, never DDL through `execute_sql`.
2. **Always add RLS policies** — every new table needs SELECT/INSERT/UPDATE/DELETE coverage for all 9 roles.
3. **Regenerate types after schema changes** — `npm run gen-types:linked` (or `gen-types:local`) rewrites `src/types/database.ts`; ship it as its own `chore(types)` PR after the push.
4. **No `any`** — TypeScript strict mode; use proper types or `unknown`.
5. **Wrap Supabase calls** in `withSupabaseRetry()` from `@/utils/errorHandling`.
6. **Test all 9 roles** — dev, master_technician, assistant, controller (assistant-like + payroll access), subcontractor, helpers (UI "Helper"), estimator, primary, superintendent.
7. **Company time zone** — `APP_CALENDAR_TZ` from `src/utils/dateUtils.ts` (Edge: `supabase/functions/_shared/appTimeZone.ts`); no new `'America/Chicago'` literals (`npm run check:timezone`).
8. **Realtime** — `useRealtimeChannel` from `src/hooks/useRealtimeChannel.ts` for every `postgres_changes` listener, filtered server-side via the `filter` string; don't add tables to the `supabase_realtime` publication casually.
9. **Branch + PR** — `main` is protected. Branch → PR (`gh pr create --fill`) → CI `checks` (typecheck + lint + test) green → squash-merge. Run `npm run typecheck && npm run lint && npm test && npm run build` locally first. Never `git add -A`.
10. **Theme tokens, not raw hexes** — CSS variables from `src/index.css`; CI runs `node scripts/theme-tokenize.mjs --check src`.
11. **Docs ship with the PR** — release note + `docs/recent-features/` fragment, migration and edge-function fragments, help guide, specialist doc: `CLAUDE.md` → Working conventions. Amend the line that holds a fact; never append feature detail to this file, `docs/AI_CONTEXT.md`, or `docs/README.md`.

---

## Migration ledger drift (linked project)

First `npm run check:migration-drift` (CI runs it daily). If it reports drift, read `CLAUDE.md` → DB migrations before touching anything — careless repairs re-create the mess the 2026-07-04 ledger rewrite cleaned up (backup at `supabase_migrations._schema_migrations_backup_20260704`). Inspect with `supabase migration list --linked`; every applied version should appear in both the Local and Remote columns.

Break-glass repairs (understand what happened before running either):
- **Remote-only version** (a ledger row with no repo file): `supabase migration repair --status reverted VERSION --linked` — edits the history table only; runs no DOWN, drops nothing.
- **Push fails "already exists"** (DDL applied but never recorded): `supabase migration repair --status applied VERSION --linked`, then `supabase db push --linked` (`--include-all` for out-of-order timestamps).

last_updated: 2026-09-20
