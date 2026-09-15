# 20260915014425_bid_specified_products.sql (2026-09-15, v2.3460)

Submittals stage 1 (`to-dos/submittals/README.md`): the plan's fixture schedule becomes data, and the pick learns its reason and lead time.

- **`bid_specified_products`** (new) — one row per (bid, tag): `tag`, `fixture` (the count-row name it maps to, snapshot text), `manufacturer`, `model`, `description`, `source` (`pasted · robot · typed`), `confirmed_by/at`, `created_by`, timestamps. UNIQUE (bid_id, tag). RLS mirrors the RFQ store: the pricing-side roles (dev · master · assistant · controller · estimator) on bids `can_access_bid_for_pricing` admits, read and write. All three fence appliers (read-only ×2 + twin).
- **`bid_quote_lines`** + `alternate_reason_kind` (`lead_time · discontinued · in_stock · equal · cost · other`), `alternate_reason_note`, `lead_time_days` (0–730; 0 = in stock), `availability` (`in_stock · lead_time · discontinued · unknown`). `pick_reason` / `pick_source` are untouched — they remain the robot's *why this house*.

Idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, constraint guards). Apply order: push after the client merge; the old client never selects the new columns, and the new client's compare treats an empty `bid_specified_products` as "no schedule pasted yet".
