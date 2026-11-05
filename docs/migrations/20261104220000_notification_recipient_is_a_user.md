# 20261104220000_notification_recipient_is_a_user.sql (2026-11-04, v2.6519)

PR 5 of punch list #260. Of the twenty-four public foreign keys to `auth.users` left after `20261104190000` dropped `users_id_fkey`, twenty-three name an actor (`created_by`, `updated_by`, `dismissed_by`, a dismissal's or a note's own `user_id`, `push_subscriptions.user_id`), which a worker who never signs in never fills. One names a receiver: `notification_history.recipient_user_id`, which refused a notice to a person with no login with `23503` (the spike's scenario F).

- `notification_history_recipient_user_id_fkey` dropped and re-made as `REFERENCES public.users(id) ON DELETE CASCADE`, added `NOT VALID` then validated (every existing recipient is a login, so a users row). The cascade stands: deleting a users row takes its notices.
- The fan-outs skip a recipient with no address before writing a row at all (`.not('email', 'is', null)` beside `REAL_ACCOUNT` in `messages-notify`, `gc-money-monday-email`, `weekly-money-email-dispatch`, `money-waiting-email-dispatch`, `schedule-day-email-dispatch`).

Idempotent (`DROP … IF EXISTS` then `ADD`). No table is created, so no fence calls. Apply order: push after the merge (no client call lands ahead of it). Bed: `supabase/tests/users_without_login/50_recipient.sql`.

**Applied** to prod by 2026-11-05: the dev seat's `check_migration_ledger` read 1118 applied with this file's version among them, against the 1118 files on `main` (read in the docs pass after #6998; `supabase` is not linked in that worktree, so `check:migration-drift` was not run there); `check:edge-drift` read every one of the 179 functions deployed and current the same day; types regenerated from prod through #7069.
