# AI Agent Instructions

> **Start here.** Read [AI_CONTEXT.md](./AI_CONTEXT.md) for the full project overview, code map, and documentation index. This file is the entry point; AI_CONTEXT.md is the source of truth.

---

## Quick Orientation

**PipeTooling** — Workflow management for master plumbers. React + TypeScript + Supabase. 5 roles, 4 major systems (Projects/Workflows, Bids, Materials, Checklist). ~50+ tables with RLS.

---

## Where to Look For...

| Need | Documentation |
|------|---------------|
| Database schema, tables, columns | `PROJECT_DOCUMENTATION.md` → "Database Schema" section |
| User role permissions | `ACCESS_CONTROL.md` → Page/Feature access matrices |
| Term definitions | `GLOSSARY.md` → All domain terms and concepts |
| Recent changes and features | `RECENT_FEATURES.md` → Chronological updates |
| Bids system | `BIDS_SYSTEM.md` → Complete workflow documentation |
| Edge Functions API | `EDGE_FUNCTIONS.md` → All 10 functions with examples |
| Migration history | `MIGRATIONS.md` → All migrations by date and category |
| Workflow features | `WORKFLOW_FEATURES.md` → Stage management, financials |
| Clock In/Out, pending sessions, pay roster | `RECENT_FEATURES.md` → v2.100; `PROJECT_DOCUMENTATION.md` → Dashboard, Hours; `GLOSSARY.md` → Clock Sessions |

---

## Critical Constraints (Non-Negotiable)

1. **Never edit existing migrations** — Append-only. Create new migration to change schema.
2. **Always add RLS policies** — Every new table needs SELECT/INSERT/UPDATE/DELETE for all 5 roles.
3. **Update types after schema changes** — `supabase gen types typescript --local > src/types/database.ts`
4. **No `any` types** — TypeScript strict mode. Use proper types or `unknown`.
5. **Wrap Supabase calls** — Use `withSupabaseRetry()` from `@/utils/errorHandling`
6. **Test all 5 roles** — dev, master, assistant, subcontractor, estimator

---

## Next Steps

1. **Read [AI_CONTEXT.md](./AI_CONTEXT.md)** — Full overview, file structure, patterns, glossary
2. **Consult the table above** — For your task, open the relevant doc
3. **Review code** — `src/pages/` for UI, `supabase/` for backend
4. **Check RECENT_FEATURES.md** — For context on recent changes
5. **Ask before changing** — Clarify requirements if unclear

---

*Full documentation lives in [AI_CONTEXT.md](./AI_CONTEXT.md). Keep that file updated; this file stays minimal.*
