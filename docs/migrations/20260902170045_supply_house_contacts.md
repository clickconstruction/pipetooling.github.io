# 20260902170045_supply_house_contacts

RFQ Round 2 Rung D (v2.2648). `supply_house_contacts` already existed
(v2.1605 — the jobs-side org-wide "share with supply house" shortlist:
label + email, house-agnostic). This EXTENDS that table instead of
creating a parallel store: nullable `supply_house_id` (NULL rows remain
the jobs shortlist; linked rows are the RFQ desk's To/CC contacts),
`name`, `is_default`, `archived_at`, `updated_at`; all four policies
recreated with estimator added to the office roles (estimators save
contacts from the RFQ compose). `bid_rfqs` gains `sent_name` +
`sent_cc text[]`. Backfills (idempotent, only houses with no linked
contacts): the house's own contact_name/email fields first, then the
newest historical request's address. Ends with all three fence appliers.
