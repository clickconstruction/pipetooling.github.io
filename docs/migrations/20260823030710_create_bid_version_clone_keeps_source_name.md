# 20260823030710 — create_bid_version: the pricing clone keeps the source scenario's name (v2.2123)

**What:** `CREATE OR REPLACE FUNCTION public.create_bid_version(p_bid_id, p_name, p_source_bid_version_id, p_clone_pricing, p_pricing_source_version_id)` — same signature and body as `20260610180000_bid_version_rpcs.sql`, with two changes inside the `p_clone_pricing` branch:
1. The clone is named after the **source scenario** (`COALESCE(NULLIF(source.name, ''), p_name)`) rather than the new version's `p_name`.
2. The new version's `starred_price_book_version_id` (v2.2117) is set to the clone, so the new bid has a ★ immediately.

`split_bid_into_versions` calls this function, so the first split benefits too.

**Why:** a version is a bid; a scenario is a price point. Naming the clone after the version put the same word on a chip and a card ("Value Engineered" as both, on 8 prod bids) — exactly the confusion the train is removing (decision D4).

**Safety:** `SET lock_timeout = '3s'`; `CREATE OR REPLACE` (idempotent); no table/RLS change; old clients call the same signature and simply get better-named clones.

**Apply:** `supabase db push` after the PR is on main. No types change.
