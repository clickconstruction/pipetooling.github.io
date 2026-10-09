# 20261010010000_bid_priced_margin.sql (2026-10-09, v2.5043)

The margin a bid was priced at, kept on the bid. Burn against the bid, piece 1, the owner's call of 2026-10-09, sent by Punchlist.

The Pricing workbench's strip already shows it: (revenue − our cost) ÷ revenue. It lasted only while the tab was open. Now it stays on the bid with the inputs it came from, so a reader can see why a stamp is partial. It freezes once the bid is sent, as the margin the bid went out at. The job's Costs verdict and Bids → Bid Costs → Bid vs actual read it beside the job's burn.

## What it does

1. **Eight nullable columns on `bids`**, with no default, so the ALTER is metadata-only:
   - `priced_margin_pct numeric`: 0–100, two decimals.
   - `priced_revenue_usd`: every row's saved price × count, alternates included.
   - `priced_cost_usd`: the workbench's total cost. That is materials + labor h × rate + driving + travel + direct costs, with no estimator time and no bid labor.
   - `priced_uncosted_usd`: revenue on priced rows with no cost. The margin counts it as profit.
   - `priced_rate_set boolean`: false means labor is $0 in the cost.
   - `priced_bid_version_id uuid` → `bid_versions`, `ON DELETE SET NULL`.
   - `priced_at timestamptz`.
   - `priced_by uuid` → `users`, `ON DELETE SET NULL`.

   They are not in `bid_changes_bid_columns()`, so a stamp writes no bid-history row.
2. **`stamp_bid_priced_margin(p_bid_id, p_bid_version_id, p_revenue_usd, p_cost_usd, p_uncosted_usd, p_rate_set) RETURNS jsonb`** is the one write. It is `SECURITY INVOKER` with `search_path = ''`, so the bid's own row policies decide who may stamp it, and the read-only and digital-twin fences on `bids` apply as to any update.
   - It rounds the inputs to cents and floors cost and uncosted revenue at 0.
   - It computes `round((revenue − cost) ÷ revenue × 100, 2)` and writes the eight columns, with `priced_at = now()` and `priced_by = auth.uid()`.
   - It writes only where `bid_date_sent IS NULL`.
   - It returns `{ok: true, margin_pct, priced_at}`, or `{ok: false, reason}` with `no_revenue`, `sent` (the bid keeps the margin it went out at) or `refused` (a bid the caller cannot update, or none).
   - A null bid id raises *Which bid?*

`SET lock_timeout = '3s'` comes first. Every `ADD COLUMN` is `IF NOT EXISTS` and the function is `CREATE OR REPLACE`, so the file is idempotent. No table is created, so the read-only and twin blocks already on `bids` stand. Grants: `authenticated`; revoked from `public, anon`.

## Checked before the PR

On a private local Postgres 15 (its own data directory confirmed before the first statement), with stand-in `users`, `bid_versions`, `bids` and `auth.uid()`:

1. An unsent bid stamped at $48,700 on $33,400 returns `{"ok": true, "margin_pct": 31.42}`. All eight columns are written, `priced_by` is the caller, and the version is kept.
2. A sent bid returns `{"ok": false, "reason": "sent"}` and nothing is written.
3. A zero revenue returns `no_revenue`, and an unknown bid returns `refused`. A negative cost and negative uncosted revenue store 0, and a missing rate flag stores `false`. A loss stores −25.00.
4. A null bid id is refused, and a second run of the whole file succeeds.
5. `anon` cannot execute, `authenticated` can, and the function is not a definer.

`src/lib/bids/bidPricedMarginSql.test.ts` pins the arithmetic, the freeze, the reasons and the columns to the client.

## Push

Punchlist pushes it after merge. The client reads it fail-soft through the untyped client until the types regenerate, in three places:

- the workbench's stamp (`stampBidPricedMargin`);
- the line under the strip;
- the verdict's and the lens's reads (`loadBidPricedMargins`).

Before the push the stamp call fails quietly and pricing goes on as before. Every surface reads "no stamp".

## Verify after the push

1. `select count(*) from public.bids where priced_at is not null` reads 0 until someone prices.
2. On the dev server, open a **ZZ TEST** bid that is not sent. Save one price on the Workbench, then wait a second. The strip shows *Kept on the bid as its priced margin: N%*, and the row reads back with the strip's revenue and cost. Touch no real bid. This write goes through the app, so it waits for the user's yes.
3. On a sent bid, `stamp_bid_priced_margin` returns `{"ok": false, "reason": "sent"}` and the row is unchanged.
