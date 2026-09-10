# 20260910120000_bid_plan_basis_exports.sql (2026-09-10, v2.3219)

Bid basis — the marked-up plans handoff from CountTooling into the Cover Letter.

- `bids.bid_to_marked_plans boolean NOT NULL DEFAULT false` — the letter toggle. When true and an export row exists, the cover letter carries the **Bid basis** clause beside the plan date and the fixture header reads "per our marked-up plans".
- New table `bid_plan_basis_exports` — one row per export CountTooling posts back (or per by-hand stamp): `filename`, `save_method` (`reported` | `manual`), `sheet_labels[]`, `sheet_count`, `page_indices[]`, `mark_totals jsonb`, `notes_count`, `include_report`, `file_size_bytes`, the CountTooling handles (`ct_project_id`, `ct_project_name`, `ct_view_token`, `ct_pdf_hash`, `ct_updated_at`), `canvas_snapshot jsonb` (CountTooling's Canvas JSON export — re-importable onto the same PDF), `superseded_at` (set on earlier rows when a newer export lands), `exported_by` → `users`.
- RLS: the same predicate as `bid_payment_schedule_rows` (role list + `can_access_bid_for_pricing(bid_id)`); controller added to the list since it is assistant-like on bids.
- Ends with both read-only appliers and the digital-twin write fence (bid-family table).

Apply order: client first is fine — the Cover Letter card only renders its button when the bid has a CountTooling plans link, and every read of the new table is wrapped so a missing table degrades to "no exports yet". Apply with `supabase db push` after the PR is on `main`, then `npm run gen-types:linked` (the types in this PR were written by hand to the generator's shape).
