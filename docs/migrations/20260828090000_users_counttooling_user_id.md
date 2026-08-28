# 20260828090000 — users.counttooling_user_id (v2.2434)

Adds `public.users.counttooling_user_id uuid NULL` — the CT↔PT bridge join key: the
CountTooling `auth.users` uuid for this person, written by the ct-bridge flows when PT
creates or looks up a CT seat. NULL = no CT seat known. Replaces matching-by-email.

- Additive and idempotent (`ADD COLUMN IF NOT EXISTS`); no backfill in the migration —
  the Phase-2 dev-settings backfill fills it via `manage-user lookup`.
- Deliberately NOT guarded by `users_guard_privileged_columns` (fires only on
  role/read_only/archived_at): dev sessions and the service-role bridge write it freely.
- Apply via `supabase db push` after the PR merges (standard rule).
