# 20261005181927_recently_sorted_team_purchases.sql (2026-10-05, v2.4566)

`list_recently_sorted_mercury_transactions_for_tally_staff(p_days integer DEFAULT 30)` — the read behind **Team purchases follow-up → Sorted**: linked-card charges whose job splits (`mercury_transaction_job_allocations`) or invoice links (`mercury_transaction_supply_house_invoice_links`) were written in the last `p_days` (clamped 1–120), newest write first, at most 300. Each row carries the card holder, the charge, `job_splits` (job id, amount, note, and the job's number, name and service type for the label), `invoice_links` (invoice id, number, date, amount, supply house), `sorted_at` (the newest of those writes) and `sorted_by_name` (its `created_by`).

Both replace RPCs delete and re-insert, so `sorted_at` is the last time anyone saved the charge, not the first.

Read only, `STABLE SECURITY DEFINER`. Viewers and scope are those of `list_stale_unlinked_mercury_transactions_for_tally_staff`: dev, master_technician, assistant, controller; `staff_can_view_user_for_tally_followup` per card holder; the org's `hide_dev_tally_transactions` flag. Anyone else gets no rows. No table, no policy.

Apply order: **either**. The window reads the function with a caught call; while it is not pushed the Sorted list is not offered and the rest of the window works as before.

Not rehearsed on a throwaway schema (docker was not running on the authoring machine); the joins and the role check are copied from the stale-list function.
