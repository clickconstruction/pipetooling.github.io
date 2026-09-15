# 20260915025302_bid_quote_line_status_override.sql (2026-09-14, v2.3464)

Submittals stage 1c (`to-dos/submittals/README.md`): the estimator's override of the derived product status rides the picked quote line.

- **`bid_quote_lines`** + `product_status_override` text, CHECK `superseded · equal · design_change` or null (null = derived from the model numbers by `deriveProductStatus`). Written by the compare's PickAnnotationDialog onto every line of the picked cell, beside v2.3460's `alternate_reason_kind` / `alternate_reason_note` / `lead_time_days` / `availability`.

Idempotent (`ADD COLUMN IF NOT EXISTS`, constraint guard). No new table, so no fence appliers. Apply order: after the client merge, together with `20260915014425` if that one is still pending; the client selects the column in its widest shape first and falls back to the kit shape until the push lands, so an old or new client never breaks either side.
