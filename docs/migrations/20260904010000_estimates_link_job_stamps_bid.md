# 20260904010000_estimates_link_job_stamps_bid (v2.2741, 2026-09-04)

**Why.** A GC's bid-room signature files as an `estimates` row (`doc_kind = 'bid_proposal'`, `bid_id`). The Jobs → Stages contract chip finds that signature by `jobs_ledger.bid_id`, but nothing set that column when the job was made from (or linked to) the signed proposal — someone had to pick the bid on Edit job by hand.

**What.** Trigger `estimates_link_job_stamps_bid` (AFTER INSERT OR UPDATE OF `job_ledger_id`, `bid_id`): when an estimates row has both a job and a bid, the job inherits the bid — **only if the job's `bid_id` is still null** (a hand-picked bid is never overwritten). Covers every door: Create job from the Estimates Ledger (`create_job_from_estimate`), Link existing job, `apply_estimate_to_job`, and any future writer. `SECURITY DEFINER` so a user who may link an estimate but not edit jobs still gets the stamp.

**Data.** No backfill needed — at push time there were 0 estimates with a `bid_id` and 0 jobs with one (verified read-only before the push).
