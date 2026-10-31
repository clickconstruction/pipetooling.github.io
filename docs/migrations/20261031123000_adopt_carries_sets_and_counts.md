# 20261031123000_adopt_carries_sets_and_counts.sql (2026-10-31, v2.6230)

An adopted bid's CountTooling projects and plan sets come along as the new version's own. The owner, on estimators who bid the same job as separate bids before versions existed: *the William version has its own count tooling and his own pricing. He also bid an older version of the plans.*

- `bid_count_sources.bid_version_id` and `bid_plan_sets.bid_version_id`: nullable, `REFERENCES bid_versions ON DELETE SET NULL`, each with a partial index. NULL = the bid as a whole, as every row read before this.
- `adopt_bid_as_version` (20261031010000's body, two carries added before the source retires): the source's `bid_count_sources` rows move to the target under the new version, except one whose token the target already holds; the source's own `count_tooling_link` becomes a row when none carries it. Its `bid_plan_sets` rows move the same way with the memo prefixed *From B<n>, adopted as the version <name>*; its own `plans_link` becomes a row named *Plans* when none carries it.

Additive and idempotent. Apply order: with v2.6230's merge, `supabase db push`, then `npm run gen:types`. Nothing waits on it: Edit Bid's two fields read `select *`, so they stand before the push and show the version chip after.
