# 20260907060000_grant_views_opaque_columns.sql (2026-09-07, v2.2995)

Follow-up to Phase 5 (`20260907050000`). The `master_assistants` / `master_shares` views selected `users.id` as plain column references, so PostgREST — and `supabase gen types` — traced them back to `users(id)` and gave **every** foreign key that references `users(id)` four extra relationships through the views: `database.ts` grew from 20.7k to 29.1k lines and the client stopped typechecking (`Type instantiation is excessively deep` on `ReturnType<typeof supabase.from>`), and resource embedding gained ambiguous `users → master_assistants / master_shares` paths.

- `CREATE OR REPLACE VIEW` both views with each id wrapped in `CASE WHEN x.archived_at IS NULL THEN x.id END` — same value on every row (the `WHERE` already excludes archived users), same type, no longer traceable to a base column.
- Column names and types unchanged, so the 84 re-bound policies and 45 functions that name the views are untouched.

After push: `npm run gen-types:linked` returns to the pre-Phase-5 shape plus the two `retired_*` tables and the two views.
