# AI Agent Instructions

> **Start here.** Read [AI_CONTEXT.md](./AI_CONTEXT.md) for the full project overview, code map, and documentation index. This file is the entry point; AI_CONTEXT.md is the source of truth.

---

## Quick Orientation

**PipeTooling** — Workflow management for master plumbers. React + TypeScript + Supabase. 7 roles, 4 major systems (Projects/Workflows, Bids, Materials, Checklist). ~50+ tables with RLS.

---

## Where to Look For...

| Need | Documentation |
|------|---------------|
| Database schema, tables, columns | `PROJECT_DOCUMENTATION.md` → "Database Schema" section |
| User role permissions | `ACCESS_CONTROL.md` → Page/Feature access matrices |
| Adding a new role | `ADDING_A_NEW_ROLE.md` → Step-by-step guide |
| Term definitions | `GLOSSARY.md` → All domain terms and concepts |
| Recent changes and features | `RECENT_FEATURES.md` → Chronological updates |
| Bids system | `BIDS_SYSTEM.md` → Complete workflow documentation |
| Edge Functions API | `EDGE_FUNCTIONS.md` → All 10 functions with examples |
| Migration history | `MIGRATIONS.md` → All migrations by date and category |
| Apply migrations / run SQL on linked Supabase (when Docker local unavailable) | Cursor **Supabase MCP** — read tool descriptors in `.cursor/.../mcps/` first; `apply_migration` for new files, `execute_sql` for ad-hoc queries; see [Supabase MCP](#supabase-mcp-cursor) below |
| Workflow features | `WORKFLOW_FEATURES.md` → Stage management, financials |
| Clock In/Out, pending sessions, Revoke, accountability, Quickfill Hours, Crew Jobs / Bids, unified job/bid search, Pay Report Jobs/Bids | `RECENT_FEATURES.md` → v2.100, v2.105, v2.114, v2.120; `PROJECT_DOCUMENTATION.md` → Dashboard, Hours, Quickfill, People; `GLOSSARY.md` → Clock Sessions |
| Testing without credentials (dev login) | `EDGE_FUNCTIONS.md` → dev-login; `/dev-login?as=<existing-email>` when `import.meta.env.DEV`; email must exist in auth.users (e.g. robert@douglasmining.com); set `VITE_DEV_LOGIN_SECRET` and `DEV_LOGIN_SECRET` |
| Set password (dev) | `EDGE_FUNCTIONS.md` → set-user-password; Settings → Active Accounts → Set password for another user |
| Dev Ignored Tasks, Recently Completed Tasks, button icons | `RECENT_FEATURES.md` → v2.110, v2.111; `PROJECT_DOCUMENTATION.md` → Dashboard; `GLOSSARY.md` → Ignored section |
| approve_clock_sessions RPC 404 / client-side | `RECENT_FEATURES.md` → v2.125; `TROUBLESHOOTING.md` → RPC 404; `TROUBLESHOOT_404.md` |
| Project superintendent assignment, Projects page master/superintendents display | `RECENT_FEATURES.md` → v2.127, v2.128; `ACCESS_CONTROL.md` → superintendent section; `PROJECT_DOCUMENTATION.md` → projects, project_superintendents |
| Job–Project link, linking jobs to projects for multi-phase billing | `RECENT_FEATURES.md` → v2.129; `PROJECT_DOCUMENTATION.md` → Jobs, projects; `MIGRATIONS.md` → 20260320140000 |
| Workflow step card collapse, collapsed header, button styling | `RECENT_FEATURES.md` → v2.132; `PROJECT_DOCUMENTATION.md` → Workflow; `WORKFLOW_FEATURES.md` |
| Collapse old stages toggle, stage breadcrumb below buttons, no-wrap scroll | `RECENT_FEATURES.md` → v2.135; `WORKFLOW_FEATURES.md` → Collapse Old Stages Toggle, Stage Breadcrumb Layout |
| Workflow Approve/Previous work incomplete, private notes (dev/master/assistant/superintendent) | `RECENT_FEATURES.md` → v2.133, v2.134, v2.137; `ACCESS_CONTROL.md` → Workflow; `WORKFLOW_FEATURES.md` |
| Line Items For Office, supply house invoice linking | `RECENT_FEATURES.md` → v2.136; `WORKFLOW_FEATURES.md` → Line Items For Office; `PROJECT_DOCUMENTATION.md` → workflow_step_line_items |
| Dispatch dismissals, closed note, inbox thread notes | `RECENT_FEATURES.md` → v2.169, v2.136; `MIGRATIONS.md`; `GLOSSARY.md` → Task Dispatch |
| Superintendent Jobs: Reports + Sub Ledger only (no Stages, Billing) | `RECENT_FEATURES.md` → v2.138; `ACCESS_CONTROL.md` → superintendent; `MIGRATIONS.md` → 20260623190000 |
| Dashboard Assigned Jobs, Superintendent Jobs, in-progress stage banner, Choose from my jobs | `RECENT_FEATURES.md` → v2.142; `PROJECT_DOCUMENTATION.md` → Dashboard; `MIGRATIONS.md` → 20260624000000_allow_superintendent_send_to_billing |
| Remove specific pins, Page pins for assistants | `RECENT_FEATURES.md` → v2.147; `PROJECT_DOCUMENTATION.md` → Settings, Dashboard |
| Bid Board All notes (unified timeline), customer notes cards, `customer_contacts.contact_method` | `RECENT_FEATURES.md` → v2.148; `PROJECT_DOCUMENTATION.md` → Bids; `MIGRATIONS.md` → 20260324120000 |
| Clock sessions table (time/location, merged notes+job, accountability lines), pending Approve/Reject/Edit order, My Roles Goals gate, `user_dashboard_goals` / `user_daily_goals_ack` | `RECENT_FEATURES.md` → v2.149; `PROJECT_DOCUMENTATION.md` → Dashboard, People Hours, Quickfill, Settings; `MIGRATIONS.md` → 20260329120000; `GLOSSARY.md` → Clock Sessions |
| Dashboard My Team: Clock activity above Active/Pending, plain "Clock activity" label, pending banner full-bar jump + expand | `RECENT_FEATURES.md` → v2.153; `PROJECT_DOCUMENTATION.md` → Dashboard |
| Dashboard Currently clocked in strip (below pins): Today hours, My team/Everyone toggle (dev/master/assistant); Materials supply house `website_url` + Open website | `RECENT_FEATURES.md` → v2.163; `PROJECT_DOCUMENTATION.md` → Dashboard, Materials Supply Houses, `supply_houses`; `src/hooks/useDashboardMyTeamSectionState.ts`; `src/components/DashboardTeamActiveClockStrip.tsx` |
| Team feedback (dev): eligibility overview per-user Reset, submit `reviewer_user_id` from session, `team_feedback_submissions_select_own` migration, raw submissions names + CSV | `RECENT_FEATURES.md` → v2.162; `MIGRATIONS.md` → 20270329140000; `src/lib/teamFeedback.ts`; `src/components/team-feedback/` |
| Settings: Sharing and Adoption merged into **People & accounts** (`settings-people`); no `settings-sharing` jump | `RECENT_FEATURES.md` → v2.165; `PROJECT_DOCUMENTATION.md` → Settings §9; `ACCESS_CONTROL.md` → Settings matrix |
| Pay History: Ledger name search; **Print** in ledger (no row **View**; bulk **Generate Pay Reports** modal still has **View**); dev delete as red trash icon | `RECENT_FEATURES.md` → v2.170; `PROJECT_DOCUMENTATION.md` → People; `src/components/pay/PayStubDeleteIcon.tsx` |

---

## Critical Constraints (Non-Negotiable)

1. **Never edit existing migrations** — Append-only. Create new migration to change schema.
   - **Always create new migration files with the CLI** — Run `supabase migration new short_description_of_change` (snake_case description). Never invent timestamps, copy an existing migration file and tweak the name, or add a second file that shares the same `YYYYMMDDHHMMSS` prefix as another file in `supabase/migrations/` (one version number → one SQL file). Edit the generated file, then apply via `supabase db push` (or MCP `apply_migration` on that file).
2. **Always add RLS policies** — Every new table needs SELECT/INSERT/UPDATE/DELETE for all 6 roles.
3. **Update types after schema changes** — `supabase gen types typescript --local > src/types/database.ts`
4. **No `any` types** — TypeScript strict mode. Use proper types or `unknown`.
5. **Wrap Supabase calls** — Use `withSupabaseRetry()` from `@/utils/errorHandling`
6. **Test all 7 roles** — dev, master, assistant, subcontractor, estimator, primary, superintendent

---

## Supabase MCP (Cursor)

When this workspace has the **Supabase MCP** server enabled, agents can apply new migration files and run SQL against the **linked** project via MCP (useful when local Docker / `supabase db reset` is not available). **Create the migration file first** with `supabase migration new …`, then edit it; use MCP `apply_migration` only for that generated path. **Always read each tool’s JSON descriptor** under the project’s `mcps` folder before calling — e.g. `execute_sql` for validation or reads, `apply_migration` to apply a file under `supabase/migrations/`. This does not replace **Critical Constraints** item 3: after schema changes, still run `supabase gen types typescript --local > src/types/database.ts` (or update `src/types/database.ts` equivalently).

---

## Next Steps

1. **Read [AI_CONTEXT.md](./AI_CONTEXT.md)** — Full overview, file structure, patterns, glossary
2. **Consult the table above** — For your task, open the relevant doc
3. **Review code** — `src/pages/` for UI, `supabase/` for backend
4. **Check RECENT_FEATURES.md** — For context on recent changes
5. **Ask before changing** — Clarify requirements if unclear

---

*Full documentation lives in [AI_CONTEXT.md](./AI_CONTEXT.md). Keep that file updated; this file stays minimal.*
