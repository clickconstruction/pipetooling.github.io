# 20260927210000_controller_reads_bids_and_estimates.sql (2026-09-27, v2.3897)

Batch 2 of the controller-access audit (punch list #48, `to-dos/controller-access.md`). `ALTER POLICY` on 89 policies across 27 tables: bids and their count rows, takeoff mappings, payment schedules and submission entries; the price, labor and takeoff books; cost estimates; estimates, their thread notes, customer events and field photos.

The expressions were read back from `pg_policies` on production the same day, so the migration sets `search_path = public` for the unqualified `users` and `user_role` they carry. Each policy keeps its name and command. `SET lock_timeout = '3s'`. No client change is needed and the order with the client does not matter.

Verify after the push: as the sample controller, `bids`, `price_book_entries` and `estimates` return the same row counts as for the sample assistant. `cost_estimates` and the bid pricing rows follow with `can_access_bid_for_pricing` in `20260927233000_controller_functions_the_rest.sql` — their policies call it.
