---
name: "The estimator's word on money: the leftovers"
number: 129
group: gated
status: SHIPPED 2026-10-20 — all seven PRs (PR 3 in two halves) and the types regen live (v2.5646–v2.5651, v2.5655, v2.5656; migrations 20261019060000–20261019120000 pushed), then the walk's fixes v2.5657, v2.5658 and v2.5659 (migration 20261020090000 pushed, types v2.5668) and v2.5670; what is left is three owner calls and the small follow-ups
summary: >
  The estimator who sold a job can now see its money and write down the customer's word on
  paying, from the won bid, the Money lens, the Dashboard and the customer's line in Messages.
  A word that they paid meets the deposit at allocation, or comes back to whoever heard it after
  a week. A primary's paid verbs hold to their own jobs. This to-do keeps only what the train
  left: three calls for the owner and the small follow-ups.
next: The owner answers the three calls below; check BP166 reads *J878 opened from this bid* as an estimator (20261020090000 is pushed, types v2.5668).
size: XS each
blocker: The owner's three calls.
opinion: yes to the estimate's author, hold the job-accounts gate, keep seven days; build the Pipeline chip first
mockup: not required — the leftovers are owner calls and small follow-ups to screens that shipped; the train's mock-up is in git history at the retiring commit
---

# The estimator's word on money: the leftovers (#129)

## What shipped

Seven PRs, 2026-10-19 to 2026-10-20, each with its release note and `docs/recent-features/` fragment:
v2.5646 the job's people (`is_job_people`), v2.5647 the money line under a won bid, v2.5648 the
customer's word as one sheet (a day they will pay by, or that they say they paid), v2.5649 the
same press under a customer's line in Messages, v2.5650 the claim at the deposit allocation and a
week with nothing landed back to whoever heard it, v2.5651 the Money lens, the Dashboard card and
the trail, v2.5655 a primary's paid verbs held to the job's people, v2.5656 the types. The guide is
*see where a job you bid stands on money*.

## The owner's calls

- **Jobs from an estimate with no bid.** Should the estimate's author count among the job's
  people when the job is made from a signed estimate (`estimates.created_by`, copied by
  `auto_create_job_from_signed_estimate`)? The opinion is yes; it widens `is_job_people` to
  residential jobs the estimator wrote the estimate for.
- **The job-accounts gate.** `estimator_can_reach_job_account(job)` opens any bid-born job's
  supply-house account to any estimator. Narrowing it to the job's people is one line, but it
  changes the Job accounts lens for an estimator working another's bids. The opinion is to hold.
- **The stale day.** A paid claim with nothing landed comes back after seven days
  (`STALE_AFTER_DAYS` in `src/lib/jobs/paidClaims.ts`). A mailed check is usually in by then.

## The follow-ups

- **The Pipeline row's chip for a paid claim.** The board reads `job_promised_pay_dates`, which a
  claim never touches, so the office sees a claim only in Job activity and at allocation. A
  *They say paid* chip on the Billed row, from `list_paid_claims`, would close that.
- **The live check as an estimator.** Done 2026-10-20 as Wendi through the app's Imitate, on prod
  data: the Money lens, the trail, the word sheet, the Dashboard card and the money line work. It
  found three breaks, each fixed in its own PR: *Send the pay page* opened an empty box (v2.5657),
  *Their record* told an estimator a customer owed $0 (v2.5658), and the Job block offered an
  estimator *Open the job* on a bid with a job while Save was refused by the insert policy. On the
  owner's call that last one became **Send to Dispatch**, a draft of the job the inbox opens as
  New Job (v2.5659, `20261020090000_job_draft.sql`, pushed; types v2.5668; the inbox's Open the job
  for the office alone since v2.5670). Left: check BP166 reads *J878 opened from this bid* as an
  estimator. No customer has written in yet,
  so *Write down their word* under a customer's line in Messages waits for a real inbound line. No
  surface opens the read-only Job Detail pane for an estimator.
- **The heard-day offer in Messages.** Cut 2's offer under a line (`message_promises`,
  `write_down`) was never drawn; a voicemail's *Keep the day* writes an offered row nobody reads
  back. When it is drawn, its press should open the same sheet with the day filled in.
- **The untyped calls.** The seven new functions are in `src/types/database.ts` since v2.5656; the
  client still calls them `as never`. Type each on the next change that touches it.

## Retire when

The three calls are answered and built or declined, and the four follow-ups are shipped or moved
to their own to-dos.
