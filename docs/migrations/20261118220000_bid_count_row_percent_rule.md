# 20261118220000_bid_count_row_percent_rule.sql (2026-11-18, v2.7848)

A count row can keep a percent rule: *this row is priced at 40% of what the pipe rows sell for*. This is the database half of the Percent row on Bids → Pricing. No screen reads or writes the column yet.

An estimator often skips counting pipe fittings and adds one row, Connections, priced at 40% of the pipe rows' revenue. Until now that was a number worked out on the calculator and typed. It went stale when a footage or a per-foot price changed, and nothing recorded the rule, so nobody could later check the percent against what was bought.

## The column, on `bids_count_rows`

| Column | Type | What it holds |
|---|---|---|
| `percent_rule` | `jsonb`, null | `{"pct": 40, "basis": "revenue" \| "cost", "source": {"kind": "pipe"} \| {"tag": "water"}}`. Null for a row with no rule, which is every row today. |

The check `bids_count_rows_percent_rule_shape` holds a rule to that shape: an object, a percent above 0 and at most 1,000, a basis of `revenue` or `cost`, and a source that is an object. A rule missing a part is refused, not read as null.

## Why the price stays where it is

The row's price is still an ordinary saved price, in `bid_pricing_assignments.unit_price_override` or `bid_count_row_custom_prices`. The Workbench will re-write that price from the rule while the bid is unsent. So the Cover Letter, Share, the History, the robots, the dev seat and `bid_pricing_history` read a bid's prices as they always have, and no total can disagree with another.

## Why the source is a kind or a tag

A rule names the rows it reads by their kind (`pipe`) or by a tag (`water`), never by row id. A copy of the rows gets new ids, and a rule by kind or tag needs no re-keying.

## A copy carries the rule

Two functions name the count row's columns one by one, so a new column is left out of a copy until each learns it (`src/lib/bids/bidCopySql.test.ts` pins this against the generated types). Both are redefined with the one column added and nothing else changed:

- `clone_count_rows_to_bid_version`, a new version of a bid: its body as `20261031015000` left it, with `percent_rule` in the copy's `INSERT`.
- `duplicate_bid_to_service_type`, a bid copied to another trade: its body as `20261031010000` left it, with `percent_rule` in the `SELECT` it loops over and in the copy's `INSERT`.

An adopt moves rows and does not copy them, so `adopt_bid_as_version` needed nothing.

## Who reads and writes it

Nothing changes. The policies on `bids_count_rows` are by row and do not read the column. Whoever may change a bid's count rows may set a row's rule.

## The bed

`supabase/tests/bid_copies/20_scenario.sql`, run by `scripts/pgtest-bid-copies.sh` with this migration applied a second time first. The seed gives one row a rule, written by an estimator through the row policies. The scenario checks that five malformed rules are refused, that a new version carries the rule, and that a duplicate carries it.

## Order

Additive and idempotent. No `CREATE TABLE`, so no fence calls. The lock is an `ALTER TABLE` that adds a nullable column with no default, which rewrites no row, and a check that every existing row passes because its rule is null, under the 3 second timeout. The push can come any time after the merge. The Workbench reads count rows with `select('*')`, so the client that follows is safe on either side of the push.

**Applied** to prod by 2026-11-18: the dev seat's `check_migration_ledger` read 1,380 versions applied against 1,381 local files, this version among them and `20261118190000` alone still to push (read in the docs pass after #8710).
