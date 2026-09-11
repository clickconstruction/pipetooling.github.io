# 20260911175700_bid_estimate_breakdown_versions.sql (2026-09-11, v2.3297)

Same-PR follow-up to `20260911175025_job_budgets.sql`: `bid_estimate_breakdown` now reads the **active version's** count rows and takeoff rough lines (`bid_version_id IS NOT DISTINCT FROM` the newest `bid_versions` row; the unsplit base is NULL) and returns `bid_version_id`. The first cut read the base only, so a versioned bid's takeoff materials came back 0 while the Labor tab showed the total (seen on BP398 during verification). Idempotent (`CREATE OR REPLACE`).
