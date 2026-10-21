# 20261020110000 — split_bid_into_versions re-asserted (v2.5692)

**What**: `CREATE OR REPLACE` of `public.split_bid_into_versions(uuid, text, text, boolean, uuid)`
with the verbatim body of its newest (and only) repo definition, `20260610190000_bid_version_split_and_guards.sql`,
plus a refreshed `COMMENT` noting that `p_clone_pricing=false` leaves the new variant unpriced.
No tables, no data, no RLS — the CREATE TABLE trio does not apply.

**Why**: the live walk of punch list #137 (ZZ bid B517, 2026-10-21) saw the unsplit
"Split into two versions" window ignore an unticked "Copy all this bid's prices" — the new
child came out with starred price copies. The client passes the checkbox and every repo
definition of the chain honors it (`create_bid_version`'s clone block is gated by
`p_clone_pricing` in all five definitions), so the symptom points at a drifted prod body of
`split_bid_into_versions`, the one function only the unsplit path exercises. Re-asserting from
the newest repo body converges prod to the repo (the `list_lien_notice_months` lesson,
2026-09-21); where prod already matches, this is a no-op.

**Risk**: minimal — one function replaced inside a transaction with `lock_timeout = '3s'`;
callers (`BidVersionPicker.submitNewVersion`, `BidsPricingTab.createOwnTakeoffAlternate`) use
the same five named arguments. Deploy before the client (the client change is words only).
