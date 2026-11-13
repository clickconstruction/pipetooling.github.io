# 20261113070000_supply_paper_check_rules — the rules a paper was checked under, and a charge outside the subtotal (v2.7103, punch list #298 PR 1c)

**File**: `supabase/migrations/20261113070000_supply_paper_check_rules.sql`
**Amends**: `supply_papers` from [`20261109170000_supply_paper_lines`](./20261109170000_supply_paper_lines.md) and `supply_paper_save` from [`20261109210000_supply_paper_save`](./20261109210000_supply_paper_save.md)

## What it changes

- **`supply_papers.check_rules smallint NOT NULL DEFAULT 1`**: the count of check rule sets a paper was last checked under (`CHECK_RULES` in `supabase/functions/_shared/paperChecks.ts`). Every paper on file was checked under the first set, so the default says so. `bill-lines-sweep` checks an off paper with `check_rules < 2` once more from the lines on file, with no model read, and stamps it 2 whether it now adds up or stays off. No paper is checked twice, and the next change to the rules raises the count and brings the off papers back once more, the way `MATCH_RULES` does for the holds.
- **`supply_paper_save` learns a charge outside the subtotal.** The sums that decide a paper's state are worked out in SQL, so this door has to know the one new rule that changes a sum. When the counted lines pass the subtotal, a charge line whose extension is exactly the gap is taken as outside (one charge first, then every charge line together), and only when the subtotal with tax, freight and that charge meets the total. The lines' side loses it and the total's side gains it. It is `outsideChargeCents` in the kernel, to the cent. The function also stamps `check_rules = 2` on the paper it writes.

Nothing else in the function changed: the gates, the one paper per bill, the lines replaced whole, the note's words.

## Why the other rules need nothing here

A rebate among an invoice's parts is a negative `extended_cents`, which the sum already takes. A rounded price and a pack priced by the piece are a line's own arithmetic, which is the client's check and can only turn a paper off.

## Order

Push before deploying `bill-lines-sweep`: the sweep writes `check_rules` on every paper it keeps and filters on it. A sweep deployed first would hold each new bill as *failed* and try again in an hour. No client calls ahead of the push.

The column add is a catalog change with a constant default, so its lock is held for an instant. `SET lock_timeout = '3s'` is the first line.

## Checked

- A throwaway local Postgres 15 with stub tables (Docker was not running on the Mac that built it): the migration applied twice, then nine assertions as an office account. A charge outside the subtotal adds up and is stamped 2. The same lines against a total that never took the charge in read *The lines are $5.00 over the subtotal.* Two charges that are outside together add up. A negative line takes its money off the sum.
- The same assertions are in the bed `npm run test:pg:bill-lines-sweep` (`supabase/tests/bill_lines_sweep/20_scenario.sql`), which re-applies this file too and runs against the whole schema in CI.
