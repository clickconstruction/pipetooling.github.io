# 20261126020832_reopen_ar_return_case_two_reasons.sql (2026-11-26, v2.8615)

The database holds a replaced returned-check case closed, as the client and the two sibling functions already do. It replaces `reopen_ar_return_case`, first written by [`20261001234500_ar_return_case_actions`](./20261001234500_ar_return_case_actions.md) and last by [`20261119104000_primary_money_desks`](./20261119104000_primary_money_desks.md). Punch list #443, row 5.

## Why

**Reopen…** under **Closed cases** in Accounts Receivable (v2.8566, wider for the office in v2.8588) undoes a close by hand: *settled another way* or *not coming*. `reopen_ar_stripe_case` and `reopen_ar_unbanked_check_case` reopen only such a case and refuse the rest. `reopen_ar_return_case` reopened any closed case and cleared `replaced_by_mercury_transaction_id`, so a case closed because a new deposit replaced it would stand open again with the deposit it named forgotten. Only the client's rule (`arCaseReopenProblem`) held it to the two reasons. `small-fixes` read the gap on 2026-11-25 (its hand-over's question 3) and the pick was to brief it beside punch list #398's database lane.

## What changes

`CREATE OR REPLACE` of **`reopen_ar_return_case(uuid) → jsonb`**. The argument, the answer, the roles (a dev, a master, an assistant, a controller), the definer and the grants are as they were, so the generated types do not change.

- A case closed as *settled another way* or *not coming* opens again, as before: the close's four columns and `replaced_by_mercury_transaction_id` clear, `updated_at` and `updated_by` stamp.
- A case closed as *replaced* is refused with *This case cannot be opened again. A new deposit replaced it, and that deposit stands.* and keeps every column.
- An open case is refused with *This check has no closed case to reopen.*, as before.

## What stays

Who may call it. The close, `close_ar_return_case`, and its three reasons. The other two reopen functions. The client's own rule, which refuses the same cases before the call.

## What it does not do

It makes and changes no table, so the four closing calls of a `CREATE TABLE` migration do not apply. It corrects no row.

## Locks

`CREATE OR REPLACE FUNCTION`, `REVOKE`, `GRANT` and `COMMENT` on one function. No table is locked. `SET lock_timeout = '3s'` opens the file.

## Order

The client calls the function by its old name with its old argument and already refuses a replaced case before the call, so neither side misreads the other. The push and the client deploy may land in either order; this PR changes no client code but a comment. `npm run check:calls-ahead` names no call: the client reaches the function by a name chosen at run time (`arCaseReopenCall`), which the finder does not see. No deploy waits for the push either way, since the function replaces one that is live.

## Test

`npm run test:pg:primary-money-desks` applies this migration a second time after the desks' two, which must change nothing, and plays `supabase/tests/primary_money_desks/30_reopen_two_reasons.sql`: an assistant closes three cases, one each way; a case settled another way and a case not coming open again; the replaced case is refused and still names its deposit; an open case and a case already reopened are refused; a reopened case closes again; a primary is refused at the door. No Postgres runs on the Mac that built this, so the SQL beds job on the PR is the proof of the SQL.

**Applied** to prod by 2026-11-26: the dev seat's `check_migration_ledger` read 1,504 versions applied against 1,504 files on `origin/main`, this version among them (read in the docs pass after #9830); no new name in `database.ts`, since the function is replaced under its own name.
