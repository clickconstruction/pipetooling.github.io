# 20260909202455_reference_presence_sent_bids.sql (2026-09-09, v2.3202)

`CREATE OR REPLACE` of `public.list_reference_presence()` (from `20260901050000`): the counts / pricing presence booleans now come back for **sent-undecided** bids as well as decided ones (`WHERE b.outcome IS NOT NULL OR b.bid_date_sent IS NOT NULL`; the `ZZ %` and `adopted_into_bid_id` exclusions are unchanged). Same SECURITY DEFINER / grants / anon revoke as before. Idempotent.

Why: the Bid Board's robot icon (v2.3202) grades a sent bid the way the Counts tab chip already does (`referenceGradeChipApplies` = sent or decided), so it needs the two inputs that aren't on the bid row for sent bids too.

Apply order: **client first (CI), then `supabase db push`**. Before the push a sent-undecided bid without a robot simply shows no icon (`robotRowState` returns `none` when presence is missing) — it never shows a wrong letter. No types change (same return shape).
