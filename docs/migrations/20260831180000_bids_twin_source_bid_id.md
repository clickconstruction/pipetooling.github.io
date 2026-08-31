# 20260831180000_bids_twin_source_bid_id

Adds `bids.twin_source_bid_id uuid` (self-FK, `ON DELETE SET NULL`) + a partial
index. On a digital-twin copy it points at the human source bid the robot bid
duplicates; null on human bids.

Consumers: the Bid Board robot-readiness icon (v2.2530) resolves the "robot bid
exists" state and deep-links to the twin row. Producers: twin-mcp
`open_backtest` (stamp added separately) and the future shadow-bid verb.

Backfill: the six existing ZZ Twin backtest pairs (b405→b376, b406→b370,
b407→b280, b408→b375, b409→b351, b410→b269) are stamped by an explicit data
pass after `db push` — the ZZ names don't match their sources mechanically, so
this is not in the migration. Additive and idempotent; no new table, so the
read-only appliers are not required.
