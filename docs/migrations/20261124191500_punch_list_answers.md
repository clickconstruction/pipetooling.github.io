# 20261124191500_punch_list_answers.sql (2026-11-24, v2.8519)

`punch_list_picks` can hold a Change answer, and the question each pick answered. The ground for punch list #438's view of the questions that wait on a person.

## Why

A punch-list card can now carry the question it waits on, as `ask:` in its front matter. The board's pick is how a person answers it. On a card with a question the control will read **Go ahead, Change, Not now**. Go ahead is the pick `do` and Not now is `later`, which the table already holds. Change had no value: it could only be a note with no pick, and such a row counts as unsorted.

A card's question also changes. A session acts on the answer and writes the next question on the card. The old pick must not read as the answer to the new question.

Diane said *Build D* on 2026-11-24, on the seven picks at the mock-up's foot. Pick 4 is this migration.

## What changes

- **`pick` may be `change`.** The check constraint `punch_list_picks_pick_check` is dropped and added again with the fifth value.
- **`answers_ask text NOT NULL DEFAULT ''`.** The card's question as it read when the pick was made. `''` is a pick on a card with no question. The page will treat a pick as the answer only while this equals the card's question today.
- The table's comment and the new column's comment say so.

The policies and the stamp trigger are unchanged: dev and master read and write, and who and when are stamped on the server.

## Who reads it

Nobody yet. The view that writes both is the next PR. The client on prod reads an unknown pick as no pick (`picksFromRows`) and never names the new column.

## Order

Additive and idempotent. A second run finds the column, drops the constraint and adds the same one. Adding a column with a constant default rewrites nothing. Adding the check scans the table, which holds a row per card, under two hundred. The `SET lock_timeout` keeps the brief lock from queueing the app. Push any time after the merge, and before the view's PR merges, then regenerate the types.

**Applied** to prod by 2026-11-24: the dev seat's `check_migration_ledger` read 1,485 versions applied against 1,485 local files, this version among the newest it listed (read in the docs pass after #9574).
