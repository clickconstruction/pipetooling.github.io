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
| Workflow features | `WORKFLOW_FEATURES.md` → Stage management, financials |
| Clock In/Out, pending sessions, Revoke, accountability, Quickfill Hours, Crew Jobs / Bids, unified job/bid search, Pay Report Jobs/Bids | `RECENT_FEATURES.md` → v2.100, v2.105, v2.114, v2.120; `PROJECT_DOCUMENTATION.md` → Dashboard, Hours, Quickfill, People; `GLOSSARY.md` → Clock Sessions |
| Testing without credentials (dev login) | `EDGE_FUNCTIONS.md` → dev-login; `/dev-login?as=user@example.com` when `import.meta.env.DEV`; set `VITE_DEV_LOGIN_SECRET` and `DEV_LOGIN_SECRET` |
| Set password (dev) | `EDGE_FUNCTIONS.md` → set-user-password; Settings → Active Accounts → Set password for another user |
| Dev Ignored Tasks, Recently Completed Tasks, button icons | `RECENT_FEATURES.md` → v2.110, v2.111; `PROJECT_DOCUMENTATION.md` → Dashboard; `GLOSSARY.md` → Ignored section |
| approve_clock_sessions RPC 404 / client-side | `RECENT_FEATURES.md` → v2.125; `TROUBLESHOOTING.md` → RPC 404; `TROUBLESHOOT_404.md` |
| Project superintendent assignment, Projects page master/superintendents display | `RECENT_FEATURES.md` → v2.127, v2.128; `ACCESS_CONTROL.md` → superintendent section; `PROJECT_DOCUMENTATION.md` → projects, project_superintendents |
| Job–Project link, linking jobs to projects for multi-phase billing | `RECENT_FEATURES.md` → v2.129; `PROJECT_DOCUMENTATION.md` → Jobs, projects; `MIGRATIONS.md` → 20260320140000 |
| Workflow step card collapse, collapsed header, button styling | `RECENT_FEATURES.md` → v2.132; `PROJECT_DOCUMENTATION.md` → Workflow; `WORKFLOW_FEATURES.md` |
| Collapse old stages toggle, stage breadcrumb below buttons, no-wrap scroll | `RECENT_FEATURES.md` → v2.135; `WORKFLOW_FEATURES.md` → Collapse Old Stages Toggle, Stage Breadcrumb Layout |
| Workflow Approve/Reject, private notes (dev/master/assistant) | `RECENT_FEATURES.md` → v2.133, v2.134; `ACCESS_CONTROL.md` → Workflow; `WORKFLOW_FEATURES.md` |
| Line Items For Office, supply house invoice linking | `RECENT_FEATURES.md` → v2.136; `WORKFLOW_FEATURES.md` → Line Items For Office; `PROJECT_DOCUMENTATION.md` → workflow_step_line_items |
| Dispatch dismissals, closed note | `RECENT_FEATURES.md` → v2.136; `MIGRATIONS.md`; `GLOSSARY.md` → Task Dispatch |

---

## Critical Constraints (Non-Negotiable)

1. **Never edit existing migrations** — Append-only. Create new migration to change schema.
2. **Always add RLS policies** — Every new table needs SELECT/INSERT/UPDATE/DELETE for all 6 roles.
3. **Update types after schema changes** — `supabase gen types typescript --local > src/types/database.ts`
4. **No `any` types** — TypeScript strict mode. Use proper types or `unknown`.
5. **Wrap Supabase calls** — Use `withSupabaseRetry()` from `@/utils/errorHandling`
6. **Test all 7 roles** — dev, master, assistant, subcontractor, estimator, primary, superintendent

---

## Next Steps

1. **Read [AI_CONTEXT.md](./AI_CONTEXT.md)** — Full overview, file structure, patterns, glossary
2. **Consult the table above** — For your task, open the relevant doc
3. **Review code** — `src/pages/` for UI, `supabase/` for backend
4. **Check RECENT_FEATURES.md** — For context on recent changes
5. **Ask before changing** — Clarify requirements if unclear

---

*Full documentation lives in [AI_CONTEXT.md](./AI_CONTEXT.md). Keep that file updated; this file stays minimal.*
