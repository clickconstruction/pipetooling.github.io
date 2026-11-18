# 20261118001000_read_only_may_tell_the_dev.sql (2026-11-17, v2.7666)

Tell the dev: an account in training mode may send a note. Punch list #380, PR 6 of six. A training account (`users.read_only`) browses everything its role can see and writes nothing. That is right for the business's records and wrong for the wrench: the people learning the app are the ones a page confuses, and their note is about the app.

## What it changes

A narrow carve-out on one table, `help_feedback`, on the pattern of the clock punch's (`20260728235607_read_only_allow_own_clock_punch.sql`). No new table.

- **The restrictive INSERT policy** `read_only_users_cannot_insert` on `help_feedback` gains an own-row escape: the caller's own `from_user_id`, `status = 'open'`, nothing in the three `closed_*` columns. Its name is unchanged, so `apply_read_only_write_blocks()`, which creates by name only when missing, never puts the blanket body back.
- **`block_if_read_only_help_feedback_row()`** and the row trigger `read_only_block_row` replace the statement trigger `read_only_block_stmt` on this table alone. A statement trigger cannot see rows. The row guard passes a training account's own open INSERT and raises on everything else, a definer function's write included.
- **`apply_read_only_stmt_blocks()`** is restated from its newest body (`20260814185815`) with one more name in its exclusion list, `help_feedback`, so the sweep that ends every CREATE TABLE migration does not re-attach the statement trigger.

## What a training account still cannot do

- Write a note as someone else.
- Write a note already closed or answered.
- Change or delete any note, its own included.
- Write to any other table. Every other table keeps its statement trigger.

## Locks

`DROP TRIGGER` and `CREATE TRIGGER` take a short ACCESS EXCLUSIVE lock on `help_feedback` alone. The file opens with `SET lock_timeout = '3s'`. The closing call to the sweep finds every table covered and locks none.

## Its bed

`tell-the-dev` (`scripts/pgtest-tell-the-dev.sh`, `supabase/tests/tell_the_dev/`, `npm run test:pg:tell-the-dev`) applies the whole schema, runs this migration and `20261117235000_help_feedback_page_notes.sql` a second time, then plays the scenario: what a note needs, who may write and read one, a training account's one door through direct writes and through definer functions, a twin's note, the dev's answer, and the sweep leaving the row guard in place.

## Verify after the push

`npm run check:migration-drift`. Then sign in as a training account, press the wrench and send a note. It lands in Notes to the dev.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
