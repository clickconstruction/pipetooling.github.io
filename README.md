# PipeTooling

A web application for Master Plumbers to track plumbing work across multiple projects and crews.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   Create a `.env` file:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

5. **Check before pushing** (the same checks CI runs)
   ```bash
   npm run typecheck   # tsc -b
   npm run lint        # eslint src (warnings allowed for now)
   npm test            # vitest run
   npm run build
   ```

## Contributing / branch workflow

`main` is **branch-protected** — no direct pushes. All changes land via a pull request whose CI `checks` job (typecheck + lint + test) must pass; merging then triggers the GitHub Pages deploy. See the "Branch workflow" section in [AI_CONTEXT.md](./docs/AI_CONTEXT.md).

```bash
git checkout -b my-change
# edit, commit
git push -u origin my-change
gh pr create --fill        # CI runs automatically
gh pr merge --squash --delete-branch   # once "checks" is green
```

## For AI Agents / New Developers

**Start here**: [AGENTS.md](./AGENTS.md) → [AI_CONTEXT.md](./docs/AI_CONTEXT.md) → [docs/README.md](./docs/README.md) (entry point → project overview → full documentation index)

**Then consult based on your task**:

| Your Task | Documentation to Read |
|-----------|----------------------|
| Understanding roles/permissions | [ACCESS_CONTROL.md](./docs/ACCESS_CONTROL.md) - Complete permissions matrix |
| Adding a new role | [ADDING_A_NEW_ROLE.md](./docs/ADDING_A_NEW_ROLE.md) - Step-by-step guide |
| Working with database/schema | [PROJECT_DOCUMENTATION.md](./docs/PROJECT_DOCUMENTATION.md) - "Database Schema" section |
| Bids system features | [BIDS_SYSTEM.md](./docs/BIDS_SYSTEM.md) - All 14 tabs documented |
| Decomposing a large page | [docs/PAGE_DECOMPOSITION_PLAYBOOK.md](./docs/PAGE_DECOMPOSITION_PLAYBOOK.md) - the method + inventory; per-surface `docs/*_ARCHITECTURE.md` maps (Bids, People, Dashboard, Jobs, JobFormModal, Materials, Settings — indexed in [docs/README.md](./docs/README.md)) |
| Edge Functions / API | [EDGE_FUNCTIONS.md](./docs/EDGE_FUNCTIONS.md) - Complete API reference |
| Recent changes/features | [RECENT_FEATURES.md](./docs/RECENT_FEATURES.md) - Chronological updates |
| App crash / outage / Supabase load (AI + CLI triage; Cursor: `.cursor/rules/supabase-incident-triage.mdc`) | [docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md](./docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md) → [SUPABASE_INCIDENT_RUNBOOK.md](./docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md); capture: [`scripts/capture-supabase-incident.sh`](./scripts/capture-supabase-incident.sh); client mitigation: [RECENT_FEATURES.md](./docs/RECENT_FEATURES.md) **v2.454** |
| Troubleshooting | [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) - White screen, Supabase, sign-in, load investigation |
| Migration history | [MIGRATIONS.md](./docs/MIGRATIONS.md) - All database changes |
| Understanding terminology | [GLOSSARY.md](./docs/GLOSSARY.md) - All domain terms and concepts defined |

**Common AI Agent Tasks**:
- **Adding a table**: Create migration (`supabase migration new …`) → Update RLS policies → **Apply** (`supabase db push`) → Regenerate types → Document
- **Adding a page**: Create component → Add route → Update navigation → Verify role access
- **Fixing RLS issue**: Check user role → Review table policies → Verify adoption/sharing
- **Understanding feature**: Check RECENT_FEATURES.md → Read relevant system doc → Review code
- **App crash / Supabase load**: Cursor rule [`.cursor/rules/supabase-incident-triage.mdc`](./.cursor/rules/supabase-incident-triage.mdc) — say *Supabase crashed* / *503* etc.; agent follows [docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md](./docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md) → Run `./scripts/capture-supabase-incident.sh` (or `supabase inspect`) → Full detail in [SUPABASE_INCIDENT_RUNBOOK.md](./docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md). Client Realtime mitigation: [RECENT_FEATURES.md](./docs/RECENT_FEATURES.md) **v2.454**.

**Key Constraints to Remember**:
- Never edit existing migrations (append-only)
- Every new table needs RLS policies for all 9 roles
- Update TypeScript types after schema changes: `npm run gen-types:linked` (regenerates `src/types/database.ts` from the linked project — the `--local` form silently blanks the file when no local stack is running)
- TypeScript strict mode: No `any` types, handle null/undefined
- Test RLS for all roles: dev, master_technician, assistant, controller, subcontractor, helpers, estimator, primary, superintendent

---

## To-dos (unfinished projects)

[`to-dos/`](./to-dos/README.md) holds projects that were designed or partly built but cannot be completed right away — a decision, a mock-up, the plan, and how to verify — so any editor or agent session can pick one up cold. Check it before starting new work on a surface it names.

## Documentation

📖 **Main Documentation**:
- **[PROJECT_DOCUMENTATION.md](./docs/PROJECT_DOCUMENTATION.md)** - Comprehensive project documentation (architecture, database schema, patterns)
- **[GLOSSARY.md](./docs/GLOSSARY.md)** - Definitions of all domain terms and technical concepts
- **[RECENT_FEATURES.md](./docs/RECENT_FEATURES.md)** - Summary of all recent features and updates
- **[WORKFLOW_FEATURES.md](./docs/WORKFLOW_FEATURES.md)** - Detailed workflow features documentation

📋 **System-Specific Documentation**:
- **[BIDS_SYSTEM.md](./docs/BIDS_SYSTEM.md)** - Complete Bids system documentation (14 tabs, book systems, workflows)
- **[EDGE_FUNCTIONS.md](./docs/EDGE_FUNCTIONS.md)** - Edge Functions API reference (user management, notifications)
- **[ACCESS_CONTROL.md](./docs/ACCESS_CONTROL.md)** - Role-based permissions matrix and access patterns
- **[MIGRATIONS.md](./docs/MIGRATIONS.md)** - Database migration history and tracking

🔧 **Troubleshooting & incidents**:
- **[TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)** - White screen, Supabase issues, sign-in, duplicate pins, load investigation links
- **[`.cursor/rules/supabase-incident-triage.mdc`](./.cursor/rules/supabase-incident-triage.mdc)** - Cursor agent: natural-language Supabase/Postgres outage triage (runs inspect / capture script playbook)
- **[docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md](./docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md)** - AI/agent playbook (*find why the app crashed*)
- **[docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md](./docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md)** - Full Supabase CLI + Dashboard log workflow
- **[scripts/capture-supabase-incident.sh](./scripts/capture-supabase-incident.sh)** - One-shot `supabase inspect` capture (gitignored output under `docs/runbooks/supabase-inspect-snapshot/`)

📝 **Feature-Specific Documentation**:
- **[PRIVATE_NOTES_SETUP.md](./docs/PRIVATE_NOTES_SETUP.md)** - Private notes, line items, and projections setup

🔧 **Database & Technical Documentation**:
- **[SALARY_CLOCK_SESSIONS.md](./docs/SALARY_CLOCK_SESSIONS.md)** - Salaried **`salary_schedule`** clock sessions (sync, split RPCs, overlap guards, migrations)

The main documentation includes:
- Project overview and architecture
- Database schema and relationships
- **Database layer improvements** (automatic timestamps, cascading updates, integrity constraints, atomic transactions)
- **TypeScript types** (`src/types/database.ts`, `src/types/database-functions.ts`) and how to keep them in sync with the schema
- Authentication and authorization patterns
- Development workflow
- Deployment instructions
- Common code patterns
- Known issues and solutions
- Future development notes

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Hosting**: GitHub Pages

The app uses strict TypeScript (`strict`, `noUncheckedIndexedAccess`). Supabase table and RPC types are maintained in **`src/types/database.ts`**; update them when the database schema or RPCs change so `npm run build` stays clean. See [PROJECT_DOCUMENTATION.md](./docs/PROJECT_DOCUMENTATION.md) for type-update patterns and known issues.

## Features (high level)

The major systems, one line each. Feature history lives in [docs/RECENT_FEATURES.md](./docs/RECENT_FEATURES.md) (grep for `v2.NNN` or a feature name); architecture and schema detail lives in [docs/PROJECT_DOCUMENTATION.md](./docs/PROJECT_DOCUMENTATION.md).

- **Customers & Projects** — customer records, project workflows with custom stages, templates, superintendent assignment
- **Workflows / stages** — assignment, lifecycle actions (start/complete/approve/send-back/skip), sub work orders (step commitments), notifications, action ledger, projections and line items (see [docs/WORKFLOW_FEATURES.md](./docs/WORKFLOW_FEATURES.md))
- **Jobs** — job tracking with the Pipeline board, reports, billing/invoicing (Stripe), payments, recurring dispatch
- **Bids** — 14-tab bid pipeline: counts, takeoff, labor, pricing, cover letters, submission tracking (see [docs/BIDS_SYSTEM.md](./docs/BIDS_SYSTEM.md))
- **Materials** — Parts Book (price book), assemblies, PO Builder, purchase orders, supply houses, job tally
- **People & Payroll** — roster, hours, clock sessions, pay reports, sub labor ledger, Subs HQ, contracts
- **Schedule / Dispatch** — dispatch grid, schedule blocks, day emails, Dispatch Mode
- **Banking** — Mercury account sync, transaction sorting and job splits, card review
- **Estimates, Prospects (incl. Hiring), Checklist, Documents, Map** — supporting systems
- **Role-based access control** — 9 roles (dev, master_technician, assistant, controller, subcontractor, helpers, estimator, primary, superintendent); [docs/ACCESS_CONTROL.md](./docs/ACCESS_CONTROL.md) is the authority on who sees what

## Deployment

The project automatically deploys to GitHub Pages when changes land on the `main` branch. Because `main` is branch-protected, changes reach it via a merged PR. CI runs `typecheck` + `lint` + `test` on every PR ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)); the deploy workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) re-runs the same `checks` job as a gate before building, so a broken `main` never ships.

> **⚠️ Three separate deploy tracks.** Merging to `main` deploys only the **client** (GitHub Pages) — CI does **not** touch the database or edge functions. **Database migrations** are applied **manually** (`supabase db push` against the linked prod project `yewfzhbofbbyvkvtaatw`); when a change couples client and DB (a migration the new client must understand, or vice-versa), **sequence them** — usually deploy the client first, then apply the migration. **Edge functions** also deploy **manually** (`supabase functions deploy <name>`) — editing `supabase/functions/*` does nothing until deployed; check alignment with `npm run check:edge-drift`. See [docs/MIGRATIONS.md](./docs/MIGRATIONS.md) and the [drift runbook](./AGENTS.md#migration-history-drift-linked-project).

**Required GitHub Secrets**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

See [PROJECT_DOCUMENTATION.md](./docs/PROJECT_DOCUMENTATION.md) for detailed deployment instructions.

**SPA / 404**: Deep links may show **404** on the document request in DevTools; see [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md). In-app **Hard Reload** uses [`/?nocache=…`](src/lib/hardReload.ts) plus `history.replaceState` to reduce noisy 404s on cache-bust reloads.

### Sync to Testing Site

To refresh the testing site (`testing-pipetooling.github.io`) with a copy of the main app:

1. Double-click **`Sync to Testing.command`** in the pipetooling project root (parent folder of this repo).
2. Terminal opens, clears the testing folder, copies everything from `pipetooling.github.io`, and waits for Enter to close.

Use this before deploying or testing changes to ensure the testing site matches production.
