# 20260921230000_stage_kind_two_way.sql (2026-09-21, v2.3696)

Data only. The Bill tab's stage chooser drops its third "—" (not a stage) button and reads **In order / Any time**; a null `jobs_ledger_fixtures.stage_kind` now means a discount row only (`syncDiscountRows` forces it). The migration flips every hand-picked null on a non-discount row to `any` (the column default — one row in production, a $50 tip) and rewrites the column comment. Idempotent; any time, before or after the client deploy (the kernel keeps reading null rows as "not a stage" either way).
