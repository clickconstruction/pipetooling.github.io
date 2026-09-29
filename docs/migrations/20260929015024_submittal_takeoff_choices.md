# 20260929015024_submittal_takeoff_choices.sql (2026-09-29, v2.4107)

Submittals → **Choose from the takeoff**. Additive; the old client ignores both.

- `bid_submittal_takeoff_choices` (bid, count row → `ticked`): the estimator's tick per takeoff fixture, remembered so a later rebuild keeps the pruning; absent = the default for the fixture's group (fixtures and equipment ticked, pipe and allowances not).
- `bid_submittal_items.source_count_row_id`: the takeoff fixture a row was built from, so × on a draft row sends it back to the left-out list and *Add from the takeoff* knows what is already on the revision.
- `bid_submittal_items.status` gains `proposed`: a row built from the takeoff with no plans' schedule to compare against.
- RLS: the bid-pricing role list + `can_access_bid_for_pricing(bid_id)`; both read-only fences applied.
