# delete-user — REMOVED from production 2026-07-17 (v2.706)

**Do not redeploy.** This directory is a read-only record of a function that was live in prod but
absent from this repo. `index.ts` here is the exact source downloaded from the deployed v38
(`supabase functions download delete-user`) immediately before it was undeployed, so the removal is
auditable and reversible if it ever turns out to have been load-bearing.

It is parked under `supabase/archive/` on purpose: the edge-function drift check
(`scripts/check-edge-function-drift.mjs`) only scans `supabase/functions/`, so nothing here is
expected to be deployed.

## Why it was removed

It was **ACTIVE in prod (v38, last updated 2026-02-22)** while being:

- **absent from this repo** — nobody could review it (`check:edge-drift` flagged it as
  "deployed but not in this repo checkout"),
- **absent from `config.toml`** — not managed here at all,
- **called by no UI** — superseded by `archive-user`, which bans + soft-archives (reversible) and is
  what the app actually uses.

And its core operation was `adminClient.from('users').delete()` — a **hard delete of `public.users`**.

**One `public.users` row cascades across 100 foreign keys**, including `jobs_ledger.master_user_id`
(every job they own → each cascading to ~17 more tables), `customers.master_user_id` (→ projects →
workflows → …), `estimates`, `prospects`, `people`, `jobs_receivables`, `clock_sessions`, `reports`,
`writeups`. Deleting one master_technician would have wiped most of their book of business in a single
call. It reassigned **customers** first (and only customers); everything else just cascaded.

## Why it defeated the safety net

Those tables *are* archived (v2.696–v2.702), so the rows would have been captured — but the restore
would be **blocked**: `jobs_ledger.master_user_id` is NOT NULL and the user row is gone, so
`restore_deleted_records` refuses and commits nothing (this is the `C9` case in the restore tests, and
`users` is deliberately not archive-covered because it FKs to `auth.users`, outside the public-schema
sweep).

That made `delete-user` the **only known path that produced archived-but-unrestorable data loss** — it
walked around the archive, one-click restore, read-only mode, and bulk-deletion alerting all at once.

It was dev-gated (403 for non-devs), so it was not an escalation on its own, but it was the payload at
the end of the `claim-dev` chain: *know the code → claim-dev → dev → delete-user → irrecoverable loss*.
Removing it and restricting `claim-dev` to break-glass (v2.706) close that chain from both ends.

## What to use instead

**`archive-user`** — bans the auth account (`banned_until`) and sets `users.archived_at`. Reversible via
`restore-user`. It is what every UI path already calls.

If a user genuinely must be erased (e.g. a deletion request), do it deliberately: reassign or delete
their owned records first, confirm `restore_deleted_records` is not the intended recovery path, and run
the delete by hand — do not resurrect a one-shot function that does it silently.
