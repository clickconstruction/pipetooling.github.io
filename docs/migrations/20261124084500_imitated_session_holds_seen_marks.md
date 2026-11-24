# 20261124084500_imitated_session_holds_seen_marks.sql (2026-11-24, v2.8459)

The four "seen" marks refuse a session someone else opened as the person. Call 2 of punch list #417, built on a yes given to the building session on 2026-11-24, after v2.8246 stopped the client sending these marks while View as is on and v2.8251 gave the server the question to ask. This is the same rule on the server, so a browser still holding an older build, or any other client, cannot mark them either. It ships alone. No client change and no function deploy.

## What it does

Each function is restated from the file that made it, with one early return when `session_opened_by_imitation()` (`20261122021600_imitated_session_holds_app_activity.sql`) says the calling session was opened by Imitate or View as.

| Function | Restated from | What it marked | What it answers for such a session |
|---|---|---|---|
| `job_note_tags_seen()` | `20261116100000_jobs_ledger_note_tags.sql` | answers to job notes the caller tagged someone in | `0` |
| `task_note_tags_seen()` | `20261117160000_task_note_tags.sql` | answers to task notes the caller tagged someone in | `0` |
| `bid_mark_requests_seen(uuid)` | `20261001170000_bid_mark_requests.sql` | bids marked for the caller | `0` |
| `legal_firm_intake_seen(uuid)` | `20261008001000_legal_firm_intake.sql` | a law firm's answers | nothing, after its own office check |

The hold answers as a call that found nothing to mark. No client reads that as a failure, so an older build shows no error. It may draw the thing as seen for that visit, and the row is not written.

`legal_firm_intake_seen` keeps its office check first, so a caller the office check refuses is still refused in words, looked as or not.

Everything else is as it was: the settings (`SECURITY DEFINER`, the search path, `row_security = off` on the two tag functions), the owners and the grants, which `CREATE OR REPLACE` keeps. The comments say the hold.

## What the bodies were restated from

A session cannot read a function's body on prod. Each body was taken from the one migration that defines it, and no later file restates any of the four. The ledger matched the repo file for file on 2026-11-24 (`npm run check:migration-drift`, 1,474 files). So the bodies are prod's unless one was changed by hand outside a migration.

## What it leaves alone

- **A press.** `bid_mark_requests_close` (Done, Not for me) and every other function a person presses for still save in View as, as that person, by design.
- **The three marks that are table writes, not functions:** `user_bid_notes_read_state`, `bid_plan_questions.seen_at` and the first look stamp. The client alone holds them (v2.8246). A server hold there would need a policy or a trigger.
- **Rows already written.** It repairs nothing.

## Order of the push and the deploy

The client calls all four, with the same arguments and the same answers, and prod's old bodies answer until the push. `check:calls-ahead` prints these as a warning and holds no deploy, since the migration creates nothing the client calls.

## Safety

`SET lock_timeout = '3s'` opens the file. Four `CREATE OR REPLACE FUNCTION` and their comments, no table, no rewrite, idempotent. Each `CREATE OR REPLACE` takes a brief lock on the function's catalog row.

A magic-link session costs one read of `user_imitations` by its `(target_id, created_at)` index on each of these calls. A password session reads no table.

## Test

`scripts/pgtest-imitated-session.sh` now applies this file a second time too, and runs `supabase/tests/imitated_session/30_seen_marks.sql` after the first scenario (`npm run test:pg:imitated-session`, on the SQL beds list). One thing of each kind is new for an office person. Her own password session marks all four and answers one of each. A dev's look, by `otp` and by `magiclink`, answers `0 0 0` and marks nothing. Done pressed in the look still closes the bid request. A person who is not the office is refused the firm's answers in words, looked as or not. Her own emailed link ten minutes after a look marks all four. The settings and the grants of the four are read back.

**Applied** to prod by 2026-11-24: the dev seat's `check_migration_ledger` read 1,485 versions applied against 1,485 local files, this version among the newest it listed (read in the docs pass after #9574).
