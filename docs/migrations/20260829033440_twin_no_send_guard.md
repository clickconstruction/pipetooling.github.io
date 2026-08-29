# 20260829033440_twin_no_send_guard

Column-level no-send/no-outcome physics for digital twins: `twin_no_send_guard()` BEFORE
INSERT/UPDATE triggers on `bids` (bid_date_sent/submitted_to/outcome), `bid_versions`
(outcome/outcome_at), and `bid_version_sends` (all writes) — RAISE for `is_digital_twin()`
sessions, no-op for humans. Complements the row-level write fence (which cannot express
column rules).
