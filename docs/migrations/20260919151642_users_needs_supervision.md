# 20260919151642_users_needs_supervision.sql (2026-09-19, v2.3611)

Supervision, PR 1 — one switch instead of team leads ([`docs/recent-features/v2.3611.md`](../recent-features/v2.3611.md)).

- **`users.needs_supervision boolean NOT NULL DEFAULT true`** — true for every helper and sub until the office decides they can run a job; the backfill sets it false for every other role (office roles and superintendents are not field labour; masters supervise by definition), so the coverage rule reads as one line: *a job-day is covered when someone listed on it does not need supervision*. New helper and sub accounts start true.
- **`users_guard_privileged_columns()`** gains a fifth rule — a dev, master or assistant may change `needs_supervision`, never their own row except a dev — and the trigger fires on that column too (`BEFORE UPDATE OF role, read_only, archived_at, is_sample, needs_supervision`). No RLS change: the existing UPDATE policy for dev / master / assistant / controller admits the writers, the guard narrows them.

Additive and idempotent. Apply order: push while the PR is open (the client reads the column in the People roster, Active accounts and Who's where — an older client ignores it), then `npm run gen-types:linked`.
