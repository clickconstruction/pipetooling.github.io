# 20261006130000_bid_submittals_sent_outside_at.sql (2026-10-06, v2.4691)

Adds `bid_submittals.sent_outside_at timestamptz` (null by default): when the office sent the revision outside the app — by email or on paper — and typed the GC's answers onto its rows. Punch list #89, item 3: BP375's Rev 1 read *draft · Sep 29* while four of its parts were rejected.

Written by the client: the first time an answer is entered on a draft row (`saveAnswer` / `approveAll` in `BidsSubmittalsTab.tsx`, the answer's day, only while the column is null) and by **Sent by email on…** on step 5 (`SubmittalRoomPanel`). Read by `describeRevisionChip` (*Rev 1 · sent by email · Sep 29*), `sentByEmailLine` on step 5, and the journey's Share stage. `get-submittal-room` is unchanged: the GC's page never saw the revision.

Additive and idempotent; no order coordination — the old client ignores the column.
