# 20260828031500 — Recently deleted: price-option bundles restore whole (v2.2412)

A directly-deleted price option (`price_book_versions` row on a live bid) was
archived completely but split across two bundles: the pbv row and its three
satellites (`bid_count_row_custom_prices`, `bid_pricing_assignments`,
`bid_count_row_submission_hides`, all `TG_ARGV 'bid_id'`) under the **bid**
uuid, its `price_book_entries` (`TG_ARGV 'version_id'`) under the **pbv** uuid.
Previewing the pbv-keyed bundle blocked on the entries' NOT NULL `version_id`
FK — the parent sat in the other bundle (BP384 / pbv 69491f86, 2026-08-27).

`CREATE OR REPLACE` of two functions, bodies based on the live prod definitions
(schema dump 2026-08-27, verified equal to 20260716210000 / 20260811060705).
No table DDL, no trigger changes (re-keying the satellite triggers to the pbv
was rejected — it would fragment Clear-all-counts bundles instead).

- **`restore_deleted_records`**: the bundle seed adds two clauses — the
  archived record whose `record_id` equals the group handle, and (only when
  that record is itself archived-unrestored) rows whose
  `row_data->>'price_book_version_id'` equals the handle. The recursive term
  gets the matching `price_book_version_id` chain. Pass-2 inserts run
  newest-first (`deleted_at DESC`, carried through the bundle jsonb) with
  `ON CONFLICT DO NOTHING`; skipped stale generations are reported as warnings,
  and `inserted`/`total` count actual inserts. FK violations still abort the
  all-or-nothing transaction.
- **`list_deleted_records`**: head-row LATERAL falls back to
  `record_id = group_key` (preferring the exact match), plus a
  `price option` kind and `〈name〉 · Bid 〈number〉` label for
  `price_book_versions` heads. Same signature and return shape.

Idempotent: `CREATE OR REPLACE` only. Verified against a scratch Postgres
loaded from the prod schema dump: pbv-handle preview/restore returns the
complete set (entries + satellites + parent, churn duplicates skipped
newest-wins); count-row and whole-bid bundles restore unchanged.
