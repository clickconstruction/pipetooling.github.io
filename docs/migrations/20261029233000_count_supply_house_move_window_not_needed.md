# 20261029233000_count_supply_house_move_window_not_needed.sql (2026-10-29, v2.6086)

The move window honors a job account marked not needed (punch list #178, `to-dos/needs-me-rail/`,
D's PR 3). The Fill them in deck's move-window kind answers each current charge with *moved*,
*asked the house* or *no job account needed*, the job-account sheet's own three states; the third
only clears the row if the window's count stops counting such a charge.

## What it does

- **`count_supply_house_move_window()`** is re-created with one more predicate: the one job's
  account at the invoice's house is not on record as `not_needed` in `job_supply_house_accounts`.
  Everything else is [20261021220000](20261021220000_count_supply_house_move_window.md): office
  roles only, the zero row otherwise, `count`, `dollars`, `asked`, `soonest_due`. Idempotent
  (`CREATE OR REPLACE`); no table, no index; the grants repeated.
- The tab's kernel takes the same rule (`isMovableAgingInvoice(inv, allocationCount, todayYmd,
  accountStatus)` in `supplyHouseAging.ts`), the Accounts payable strip reads the pairs' accounts
  for it, and the SQL bed's scenario gains a row on a not-needed account (never counted) and a
  scenario that marks a counted job's account not needed live.

## Deploy

`supabase db push` from the main checkout after the merge. Until the push the client excludes
such charges from the strip and the deck while the line's count still includes them, so the line
may read one or two higher than the deck's rows; the push closes the gap. No edge function.
