# Documentation index

> One-stop map of every doc in this repo: what it's for, when to read it, and how it's maintained.
> Entry order for agents: [`AGENTS.md`](../AGENTS.md) (constraints + login) → [`AI_CONTEXT.md`](./AI_CONTEXT.md) (project overview) → the specialist doc for your task (below).

## Reading order for a new agent

1. [`../CLAUDE.md`](../CLAUDE.md) — hard rules (migrations, deploy tracks, conventions). Loaded automatically in Claude Code.
2. [`../AGENTS.md`](../AGENTS.md) — agent entry point: dev login, non-negotiable constraints, migration-drift recovery.
3. [`AI_CONTEXT.md`](./AI_CONTEXT.md) — project overview: systems, concepts, file map, patterns, glossary.
4. The specialist doc for your task — see the table below.
5. [`RECENT_FEATURES.md`](./RECENT_FEATURES.md) — grep it (don't read it top-to-bottom; it's a 17k-line changelog) for the history of any surface you're touching.

## Specialist docs

| Doc | Purpose |
|---|---|
| [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) | Full technical reference: schema, pages, features. Documents ~55 of 234 tables; feature sections carry the rest. |
| [`ACCESS_CONTROL.md`](./ACCESS_CONTROL.md) | Authoritative role/permission matrices for all 9 roles. Prefer this over role notes in other docs. |
| [`ADDING_A_NEW_ROLE.md`](./ADDING_A_NEW_ROLE.md) | Step-by-step checklist for adding a role (updated with controller-rollout lessons). |
| [`GLOSSARY.md`](./GLOSSARY.md) | Domain terms, abbreviations, feature names. |
| [`RECENT_FEATURES.md`](./RECENT_FEATURES.md) | Append-only changelog, one entry per PR (`v2.NNN`). The single home for per-feature detail. |
| [`MIGRATIONS.md`](./MIGRATIONS.md) | Migration history + the baseline-squash story. Pair with `npm run check:migration-drift`. |
| [`EDGE_FUNCTIONS.md`](./EDGE_FUNCTIONS.md) | Reference for all Supabase Edge Functions (deploy is manual — see `../CLAUDE.md`). |
| [`BILLING_FLOWS.md`](./BILLING_FLOWS.md) | Billing system map: job lifecycle, invoices/break-offs, the three billing channels, Stripe test/live plumbing, payments, send-backs, cleanup — plus the live-test safety brief. |
| [`BIDS_SYSTEM.md`](./BIDS_SYSTEM.md) | Bids system: all tabs, workflow, schema. |
| [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) | Decomposition map of `src/pages/Bids.tsx` (per-tab state/coupling, extraction status). |
| [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md) | Same map for `src/pages/People.tsx`. |
| [`DASHBOARD_SECTIONS_ARCHITECTURE.md`](./DASHBOARD_SECTIONS_ARCHITECTURE.md) | Same map for `src/pages/Dashboard.tsx` (section-based, not tabbed). |
| [`JOBS_TABS_ARCHITECTURE.md`](./JOBS_TABS_ARCHITECTURE.md) | Same map for `src/pages/Jobs.tsx` (Stages board + job-mutation engine mapped in depth). |
| [`JOB_FORM_MODAL_ARCHITECTURE.md`](./JOB_FORM_MODAL_ARCHITECTURE.md) | Same map for `src/components/jobs/JobFormModal.tsx` (a modal — form sections, not tabs; save-engine deep-dive). |
| [`MATERIALS_TABS_ARCHITECTURE.md`](./MATERIALS_TABS_ARCHITECTURE.md) | Same map for `src/pages/Materials.tsx` (written proactively — low-churn, no extraction scheduled). |
| [`SETTINGS_TABS_ARCHITECTURE.md`](./SETTINGS_TABS_ARCHITECTURE.md) | Same map for `src/pages/Settings.tsx` (documents what's already extracted + what remains). |
| [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) | The method for breaking down god components + current large-file inventory. Start here for extraction work. |
| [`SALARY_CLOCK_SESSIONS.md`](./SALARY_CLOCK_SESSIONS.md) | Salaried auto-session sync behavior runbook. |
| [`TIME_AND_ZONES.md`](./TIME_AND_ZONES.md) | Company timezone rules (`APP_CALENDAR_TZ`), instants vs wall-clock. |
| [`WORKFLOW_FEATURES.md`](./WORKFLOW_FEATURES.md) | Workflow page: stage management, line items, financials. |
| [`PRIVATE_NOTES_SETUP.md`](./PRIVATE_NOTES_SETUP.md) | Notes-for-Office + line items + projections on workflow steps. |
| [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) | White screen, RPC 404s, sign-in, load problems. |
| [`runbooks/AGENT_APP_CRASH_INVESTIGATION.md`](./runbooks/AGENT_APP_CRASH_INVESTIGATION.md) | Ordered checklist for "why did the app crash" (503s, timeouts). |
| [`runbooks/SUPABASE_INCIDENT_RUNBOOK.md`](./runbooks/SUPABASE_INCIDENT_RUNBOOK.md) | Deep Supabase incident inspection (CLI + Dashboard logs). |
| [`REMOTE_SCHEMA_INSPECTION.md`](./REMOTE_SCHEMA_INSPECTION.md) | Obsolete incident snapshot; kept for its generic schema-inspection queries only. |
| `../src/content/help/*.md` | User-facing help guides (ship with features — see `../CLAUDE.md`). |

## Maintenance rules (how these docs stay fresh)

- **Per-feature detail goes in `RECENT_FEATURES.md` only** (plus the one matching specialist doc). Entry docs (`AGENTS.md`, `AI_CONTEXT.md`, this index) are lean routers — never append feature detail, version numbers, or component inventories to them.
- **One `last_updated` stamp per doc**, in frontmatter. No line-number hints in frontmatter (`key_sections` names only) — line numbers rot immediately.
- Docs ship with features: `RECENT_FEATURES.md` entry per PR, `MIGRATIONS.md` entry per migration, `EDGE_FUNCTIONS.md` section per function, help guide per user-facing flow (all enforced by convention in `../CLAUDE.md`).
- Migration files cited in docs may live in `supabase/archive/migrations-pre-baseline/` — history was squash-baselined at `20250101000000_baseline.sql` (2026-06-04); "2027"-dated filenames in the archive are typos from spring 2026.

last_updated: 2026-07-18
