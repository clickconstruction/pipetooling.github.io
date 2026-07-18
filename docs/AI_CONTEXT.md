# AI Context - Quick Project Overview

> **Purpose**: A genuinely quick overview of PipeTooling for AI agents and new developers. Read [`../AGENTS.md`](../AGENTS.md) first (constraints + dev login), this second, then the specialist doc for your task ([`README.md`](./README.md) index). Per-feature history lives in [`RECENT_FEATURES.md`](./RECENT_FEATURES.md) — grep it; never append feature detail to this file.

---

## Project in 30 Seconds

**PipeTooling** is a workflow management system for master plumbers to track work across multiple projects and crews.

- **Domain**: Commercial/residential plumbing project management + bid estimation
- **Stack**: React 18 + TypeScript (strict) + Supabase (PostgreSQL + Auth + RLS + Edge Functions), Vite, GitHub Pages
- **Users**: 9 roles with layered access control — dev, master_technician, assistant, controller (assistant-like + payroll access), subcontractor, helpers (UI "Helper"), estimator, primary, superintendent
- **Major systems**:
  1. **Projects/Workflows** — ongoing work tracking: customers → projects → workflow stages → line items
  2. **Bids** — estimation: 14 tabs from Bid Board through Takeoff/Pricing to Submission and Change Orders (`docs/BIDS_SYSTEM.md`)
  3. **Materials** — supply houses, price book, templates, purchase orders, PO Generator ledger
  4. **Checklist** — recurring tasks: Today / History / Review / Manage / Roadmap
- **Major subsystems**: Jobs (ledger, Stages board, billing, AR), Estimates (internal proposals + customer acceptance), Banking (Mercury + Stripe, accounting labels), People (payroll, hours, employment, contracts), Prospects (leads + Team hiring board), Schedule Dispatch, Quickfill (billing workflow), Documents, Map, Tally

---

## Branch workflow

`main` is protected: no direct pushes. All changes land via a PR whose CI `checks` job (typecheck + lint + test, [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) must pass; branches must be up to date before merging.

```bash
git checkout -b my-change
# edit, commit
git push -u origin my-change
gh pr create --fill          # CI runs automatically
gh pr merge --squash --delete-branch   # once "checks" is green
```

Merging to `main` triggers the GitHub Pages deploy ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)), which re-runs the same checks before building. **DB migrations and Edge Functions deploy separately and manually** — see `../CLAUDE.md` (three deploy tracks).

---

## Critical Concepts

### Access Control Patterns

**Master-Assistant Adoption** (many-to-many):
- Masters "adopt" assistants to grant access to their customers/projects
- One assistant can work for multiple masters
- Controlled via `master_assistants` table + RLS policies

**Master-Master Sharing**:
- Masters can share their data with other masters (assistant-level, view-only)
- Controlled via `master_shares` table

**Project Owner = Customer Owner**:
- Projects inherit the customer's owner; enforced by trigger `cascade_customer_master_to_projects()`

**RLS Everywhere**:
- Every table has Row Level Security; policies check ownership, role, adoption, sharing
- Helper/capability functions prevent timeouts and centralize role logic: `is_dev()`, `is_assistant()` (assistant + controller), `has_payroll_access()`, `can_access_project_via_step()`
- **Read-only training mode**: users flagged `users.read_only` are blocked from writes by restrictive policies; every CREATE TABLE migration must end with `SELECT public.apply_read_only_write_blocks();`

### Data Flow

```
Customer (has master_user_id)
  → Project (master_user_id matches customer)
    → Workflow (one per project)
      → Steps/Stages (assigned to people)
        → Line Items (financial tracking)
        → Actions (status history ledger)
```

### Key Relationships

- **Adoption**: `master_assistants(master_id, assistant_id)` — grants data access
- **Sharing**: `master_shares(sharing_master_id, viewing_master_id)` — grants view access
- **Ownership**: FKs to `users.id` as `master_user_id` or `created_by`
- **Project Superintendent Assignment**: `project_superintendents(project_id, superintendent_id)`; superintendents gain access via adoption OR assignment
- **Job–Project Link**: `jobs_ledger.project_id` (nullable FK) for multi-phase billing; job owner must match project owner when linked (trigger)
- **Name-join fragility**: payroll config joins `trim(users.name) = people_pay_config.person_name` (no FK) — renames break sync/gating (see `SALARY_CLOCK_SESSIONS.md`)

---

## Tech Stack Quick Reference

### Frontend
- React 18 functional components + hooks; React Router DOM; Vite
- TypeScript strict mode (`strict`, `noUncheckedIndexedAccess`)
- State: React Context + local state (no Redux/Zustand/React Query)
- **Themes**: light/dark via CSS variables in `src/index.css` — use tokens (`var(--surface)`, `var(--text-muted)`, …), never raw neutral hexes (CI-enforced)

### Backend
- Supabase: PostgreSQL 15 + RLS, Auth, Edge Functions (Deno), some Realtime
- ~234 tables; ~58 Edge Functions (`docs/EDGE_FUNCTIONS.md`)
- Linked prod project: `yewfzhbofbbyvkvtaatw` ("plumbing-stage-manager"); **no staging** — migrations hit prod

### Deployment (three separate tracks — see `../CLAUDE.md`)
1. **Client**: merge to `main` → GitHub Actions → GitHub Pages (`dist/`, `copy404Plugin` writes `404.html` for deep links; SPA reload via `src/lib/hardReload.ts` + `index.html`)
2. **DB migrations**: manual `supabase db push` after the file is on `main`
3. **Edge Functions**: manual `supabase functions deploy <name>` (`create-user` keeps `verify_jwt = false` in `config.toml`)

### Type Safety
- Types auto-generated from schema into `src/types/database.ts`: `npm run gen-types:local` or `npm run gen-types:linked`
- Manual function types: `src/types/database-functions.ts`

---

## File Structure

```
pipetooling.github.io/
├── src/
│   ├── pages/              # Route-level pages (Dashboard, Jobs, Bids, People, …)
│   ├── components/         # UI components, grouped by area (jobs/, bids/, people/, banking/, …)
│   ├── contexts/           # React contexts (Toast, ForceReload, JobsListCache, modal openers, …)
│   ├── hooks/              # Custom hooks (useAuth, usePeopleAccess, useRealtimeChannel, …)
│   ├── lib/                # Pure logic kernels + Supabase helpers (unit-tested with vitest)
│   ├── utils/              # errorHandling, dateUtils (APP_CALENDAR_TZ), teamLabor, …
│   ├── types/              # database.ts (generated), database-functions.ts (manual)
│   └── content/help/       # User-facing help guides (ship with features)
├── supabase/
│   ├── migrations/         # Post-baseline migrations (baseline: 20250101000000_baseline.sql)
│   ├── archive/            # Pre-baseline migration history (2027-dated names are typos)
│   └── functions/          # Edge Functions (Deno)
├── docs/                   # All documentation (index: docs/README.md)
└── scripts/                # CI checks: migrations, drift, theme tokens, timezone
```

### Largest files (extraction candidates — see `PAGE_DECOMPOSITION_PLAYBOOK.md`)

`src/pages/Jobs.tsx` (~10.5k lines), `src/pages/Dashboard.tsx` (~8.9k), `src/components/jobs/JobFormModal.tsx` (~7.1k), `src/pages/Materials.tsx` (~6.9k), `src/components/bids/BidsTakeoffTab.tsx` (~5.6k), `src/pages/Estimates.tsx` (~5.3k), `src/pages/Settings.tsx` (~5.1k), `src/components/people/PeopleReviewTab.tsx` (~5.0k), `src/pages/Workflow.tsx` (~4.8k). Bids.tsx (~3.8k) and People.tsx (~4.3k) are already decomposed — their architecture maps show the pattern.

### Core infrastructure files

- `src/hooks/useAuth.ts` — `AuthProvider` + `useAuth()` (session + role)
- `src/lib/supabase.ts` — Supabase client (`db: { schema: 'public' }`)
- `src/components/Layout.tsx` — nav, role-gated routes (with `src/lib/layoutRouteAccess.ts`)
- `src/contexts/ToastContext.tsx` — `useToastContext()` for toasts
- `src/utils/errorHandling.ts` — `withSupabaseRetry()`

---

## Common Tasks

### Adding a New Database Table

1. **Create migration**: `supabase migration new add_my_table` (number from `origin/main` — see `../AGENTS.md`)
2. **Write SQL**: CREATE TABLE + RLS policies + constraints; end with BOTH `SELECT public.apply_read_only_write_blocks();` and `SELECT public.apply_read_only_stmt_blocks();`
3. **Merge the PR**, then **apply**: `supabase db push` (never MCP `apply_migration` / SQL editor)
4. **Update types**: `npm run gen-types:linked`
5. **Test RLS** for all 9 roles
6. **Document**: `MIGRATIONS.md` entry + relevant specialist doc

### Adding a New Page/Route

1. Create `src/pages/MyPage.tsx`; add `<Route>` in `src/App.tsx`
2. Update `src/components/Layout.tsx` nav + `src/lib/layoutRouteAccess.ts` role paths
3. Ensure RLS supports the intended roles; update `ACCESS_CONTROL.md`

### Debugging RLS Issues

1. Check the user's role in `public.users`
2. Review the table's policies (baseline + later migrations)
3. Verify `master_assistants` / `master_shares` relationships
4. Consult `ACCESS_CONTROL.md` for expected permissions

### Supabase load / "crash" investigation

1. `docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md` (ordered checklist) → `docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md` (full detail)
2. Capture: `./scripts/capture-supabase-incident.sh`
3. `TROUBLESHOOTING.md` for client-side symptoms

### Testing Without Credentials (Dev Login)

See `../AGENTS.md` → "Logging in as an agent" — `/dev-login?as=<existing-email>` in local dev; email must exist in `auth.users`.

---

## Key Patterns

### Error Handling
```typescript
import { withSupabaseRetry } from '@/utils/errorHandling'

const { data, error } = await withSupabaseRetry(() =>
  supabase.from('table').select()
)
```

### RLS Helper Functions
```sql
-- Prevent recursion and timeout in complex policies; centralize role logic
CREATE FUNCTION is_dev() RETURNS boolean
  SECURITY DEFINER
  AS $$ SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'dev'
  ) $$;
-- Capability functions (is_assistant(), has_payroll_access()) let a new role
-- slot in by editing one function instead of dozens of policies.
```

### Atomic Transaction Functions
```sql
-- Multi-step operations with automatic rollback
CREATE FUNCTION create_project_with_template(...)
  RETURNS project_workflows
  AS $$ -- multiple INSERTs in one transaction $$;
```

### Pure Logic Kernels
Business logic is extracted into pure `.ts` modules in `src/lib/` with colocated vitest tests (`*.test.ts`). There is no render-test harness — testable logic goes in kernels, components stay thin. ~230 test files.

### State Management
- **Global**: React Context (Toast, ForceReload, modal openers, caches)
- **Page-level**: `useState` / `useEffect`
- **Server state**: direct Supabase queries; Realtime via `useRealtimeChannel`

### Type Safety
```typescript
import { Database } from '@/types/database'
type Customer = Database['public']['Tables']['customers']['Row']
```

---

## Domain Glossary (starter set — full glossary in `GLOSSARY.md`)

### User Roles (9)
- **dev**: system administrator, full access
- **master_technician** (Master): project owner/manager, creates customers/projects
- **assistant**: support staff under masters (adoption-based access)
- **controller**: assistant-like + dev-level money visibility and payroll access
- **subcontractor** (Sub): external worker, sees only assigned work; optional service-type restriction
- **helpers** (UI "Helper"): field helper, subcontractor-like access
- **estimator**: bid specialist — Bids, Materials, Map, Calendar; optional service-type restriction
- **primary**: client-side principal with billing visibility (Dashboard, Estimates, Jobs, Bids)
- **superintendent**: site supervisor; access via adoption or per-project assignment

### Project Management
- **Customer**: client or General Contractor (GC)
- **Project → Workflow → Stage/Step**: one workflow per project; stages like "Rough In", "Top Out", "Trim Set"
- **Action**: status change event (started, completed, approved, …)
- **Line Item / Projection / Ledger**: financial entries, forward estimates, and their combined history
- **Notes for Office**: per-stage notes visible to dev/master/assistant-like/superintendent (formerly "private notes")

### Bids
- **Fixture / Tie-in**: plumbing unit / connection point counted during Takeoff
- **Books** (Takeoff/Labor/Price): template libraries mapping fixtures to materials, hours, prices
- **Margin**: `(revenue - cost) / revenue`
- **Bid Versions / Pricings**: named per-bid variants of takeoff + pricing

### Jobs & Money
- **jobs_ledger**: the Jobs system's core table (HCP numbers, stages, billing status)
- **Mercury / Stripe**: bank transactions (cost side) / customer invoicing (revenue side), reconciled in Banking and Jobs
- **Clock sessions**: time tracking; salaried people get auto-materialized sessions (see `SALARY_CLOCK_SESSIONS.md`)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│   Pages (src/pages) → area components (src/components)  │
│   → pure kernels (src/lib, unit-tested)                 │
│                          │                               │
│                   AuthContext (useAuth)                  │
└──────────────────────────┼──────────────────────────────┘
                           │ Supabase JS client
┌──────────────────────────┼──────────────────────────────┐
│                 Supabase Backend (prod only)             │
│  PostgreSQL: ~234 tables, RLS everywhere, triggers,      │
│    SECURITY DEFINER helpers, transaction functions       │
│  Auth: email/password + magic links (dev-login,          │
│    login-as-user)                                        │
│  Edge Functions (Deno, ~58): email (Resend), Stripe,     │
│    Mercury sync, geocoding, notifications, cron jobs     │
└─────────────────────────────────────────────────────────┘
```

---

## Critical Constraints

See `../AGENTS.md` → Critical Constraints (authoritative list): append-only migrations applied via `db push` only, RLS on every table, 9-role testing, regenerated types, no `any`, `withSupabaseRetry`, `APP_CALENDAR_TZ`, `useRealtimeChannel`, theme tokens, branch+PR workflow, docs ship with the PR.

### Code Style
- Functional components + hooks; async/await over `.then()`
- Null safety: `?.` and `??` everywhere (strict + `noUncheckedIndexedAccess`)
- Component size: break down files over ~500 lines; extract logic to `src/lib` kernels
- Match surrounding idiom; theme tokens for colors

---

## Quick Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| 403 Forbidden | RLS policy — check role, adoption/sharing, table policies |
| Row not found / empty results | RLS filtering — verify ownership/adoption |
| TS build errors after schema change | Regenerate types (`npm run gen-types:linked`) |
| Email not sending | Resend key/domain in Edge Function secrets |
| App crash / 503 / slow | `docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md` |
| White screen / stale bundle | `TROUBLESHOOTING.md` (hard reload, fix-cache) |

---

## Next Steps

**For AI agents**: consult the specialist doc for your task (`README.md` index) → review code → grep `RECENT_FEATURES.md` for the surface's history.

**For new developers**: `../README.md` for setup → this file → `PROJECT_DOCUMENTATION.md` for depth → run the app (`npm install && npm run dev`).

last_updated: 2026-07-17
