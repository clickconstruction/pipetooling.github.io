# 20260921163920_bid_takeoff_stage_splits.sql (2026-09-21, v2.3671)

Materials by stage (Wendi's schedule of values), PR 1 of 4.

- **`bid_takeoff_stage_splits`** — one stage split per scope on a Combined-model takeoff: the fixture (`line_id` and `part_id` NULL), one part line or a whole assembly bundle line (`line_id` set), or one part inside a bundle line (`line_id` + `part_id`). Three relative weights `rough_in` / `top_out` / `trim_set` (`1·1·0` = an even split), `source` (`hand` / `rule` / `book` / `assembly`). Missing row = inherit from the scope above; a row is deleted, never zeroed. Unique per scope via an expression index that coalesces the NULLs (so the client selects before insert / update instead of upserting). FKs cascade from the bid, the count row, the line and the part. `updated_at` touch trigger.
- **`bids.include_materials_by_stage`** (boolean, default false) — the Cover Letter pill (PR 3).
- **`bids.sov_material_factor`** (numeric 1–5, NULL) — a per-bid override of the factor.
- **`app_settings` `bid_sov_material_factor_v1`** seeded at **1.5** — the company factor (Settings → Templates & testing → Bid cover letter defaults).
- RLS mirrors `bid_payment_schedule_rows` (dev, master_technician, assistant, controller, estimator, primary, superintendent **and** `can_access_bid_for_pricing(bid_id)`); both read-only appliers and the digital-twin write fence run.

Apply order: client first or migration first — the client reads the table only from PR 2's Sheet, and PR 1's client (the Settings factor field) tolerates the missing row (1.5 fallback). Types were hand-added to `src/types/database.ts`; regenerate with `npm run gen-types:linked` after the push.
