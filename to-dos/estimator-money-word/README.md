---
name: "The estimator's word on money: the leftovers"
number: 129
group: close
status: LANDED 2026-11-08 — the owner's three calls of that day built or held (yes to the estimate's author, #7316 v2.6694 with its migration `20261108100000_job_people_estimate_author.sql` pushed to prod the same evening; the job-accounts gate holds; seven days stays) and the first follow-up, *They say paid* on the Billed row, landed as #7317 v2.6695; both walks ran on the dev server and are recorded under *Where it stands*; the train of 2026-10-19/20 (v2.5646–v2.5651, v2.5655–v2.5659, v2.5668, v2.5670) is live; left: Messages' *Write down their word* on a real inbound line (BP166 read as the estimator 2026-11-09 through the dev seat), the heard-day offer in Messages, the five untyped calls
ver: v2.6694 · v2.6695
summary: >
  The estimator who sold a job can now see its money and write down the customer's word on
  paying, from the won bid, the Money lens, the Dashboard and the customer's line in Messages.
  A word that they paid meets the deposit at allocation, or comes back to whoever heard it after
  a week. A primary's paid verbs hold to their own jobs. Since 2026-11-08 the estimator who wrote
  a signed estimate is one of the job's people too, with a red E beside their name, and the office
  sees a paid claim on the Pipeline's Billed row. This to-do keeps what is left: the live checks
  and the heard-day offer in Messages.
next: Nothing left to land. BP166 was read as the estimator role's sample account through the dev seat on 2026-11-09 (under *Where it stands*). The one live check left waits on a real row: *Write down their word* under a customer's line in Messages once a customer writes in. The heard-day offer in Messages is a small build of its own when wanted.
size: XS each
blocker: none — the owner's three calls are answered (2026-11-08)
opinion: the heard-day offer in Messages is a small build of its own; the untyped calls are typed as each is touched (`list_paid_claims` typed in PR 2)
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

## Where it stands

Landed 2026-11-08 by the landing session: #7316 (v2.6694, the estimate's author among the job's
people with the red E chip, its migration) and #7317 (v2.6695, *They say paid* on the Billed row)
merged through the queue; `20261108100000_job_people_estimate_author.sql` pushed to prod right
after #7316 merged (the Applied line is on its page under `docs/migrations/`). Both branches were
behind main when picked up and were brought level by merging main in (the card's README was the one
conflict, the hand-off note against the BUILT text).

The two walks ran on the dev server as the dev the same day:

- **The E chip.** No ZZ test job comes from a signed estimate, so the read-only walk opened job
  1082 *Johnson Post Test*, made from signed estimate #166: the Job window's Assigned Team lists
  the two techs and the estimate's author with a small red **E** after her name, white on red,
  whose link is `/estimates/166` and whose title reads *Wrote estimate #166, the one this job came
  from. Opens it.* Nothing was pressed.
- **They say paid on the Billed row.** On ZZ TEST sink (1064, Billed, parked in Collections) the
  dates ledger read *Billed Oct 28 · 11d ago · Expected Oct 28 · 11d past*. Its press opened Write
  down their word; *They say they paid…* with Nov 6 and a check in the mail, then **Write it
  down**, and the ledger read *Billed Oct 28 · 11d ago · They say paid Nov 6 · 2d ago* in green with
  the check-in-the-mail line under it and the title naming who said it and who heard it. The word
  was then taken off with *never said that* and the ledger went back to *Expected Oct 28*;
  `list_paid_claims` is empty again. (The Pipeline hides ZZ jobs per device: Hide groups → ZZ test
  jobs shows them.)

- **BP166 as an estimator** (2026-11-09, the dev seat's `view_as` on the estimator role's sample account, `get_bid` on
  BP166, read-only): the bid reads whole under the estimator's RLS, and its account strip names the job the Job block
  reads as *J878 opened from this bid*: job 878 *Take 5- Seguin* at the bid's address, with its four supply-house rows.
  The words themselves were not rendered, since rendering them means pressing Imitate in the owner's Chrome; the row the
  chip reads is visible to the estimator, which is what the check asked.

Left on the card: Messages' *Write down their word* on a real inbound line, the heard-day offer in
Messages, and the five calls still untyped.

## The owner's calls

Answered 2026-11-08.

- **Jobs from an estimate with no bid — yes.** The estimate's author counts among the job's
  people when the job is made from a signed estimate. Built as PR 1 (v2.6694):
  `is_job_people` re-stated with one more leg — `estimates.created_by` on a `customer_accepted`
  estimate whose `job_ledger_id` is the job and that is not a change order, the mark
  `auto_create_job_from_signed_estimate` leaves (`20261108100000_job_people_estimate_author.sql`);
  every gate on the predicate widens with it. Wherever the office sees a job's people — the
  people line over Job activity, the Assigned Team on the Job window, Everyone on the job from
  the Pipeline's crew line — that person wears a small red **E** chip whose press opens the
  estimate (`EstimateAuthorChip.tsx` over `lib/jobs/jobPeople.ts`); an author the office never
  put on the team is listed all the same.
- **The job-accounts gate — hold.** `estimator_can_reach_job_account(job)` keeps opening any
  bid-born job's supply-house account to any estimator; the Job accounts lens for an estimator
  working another's bids stays as it is.
- **The stale day — seven days stays.** A paid claim with nothing landed comes back after seven
  days (`STALE_AFTER_DAYS` in `src/lib/jobs/paidClaims.ts`).

## The follow-ups

- **The Pipeline row's chip for a paid claim.** Built as PR 2 (v2.6695): the Billed row's dates
  ledger reads the job's open claim from `list_paid_claims` and draws **They say paid** with the
  day they named, green for a week and amber with *nothing landed in N days* after it, its press
  the Write down their word sheet; the board read `job_promised_pay_dates` alone before, which a
  claim never touches. The phone rows' one line has no room for the words; the card opens the
  sheet where the ledger draws.
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
  client called them `as never`. Type each on the next change that touches it: `list_paid_claims`
  is typed since PR 2 (v2.6695); the other six wait.

## Retire when

The three calls are answered and built or declined (done 2026-11-08), and the four follow-ups are
shipped or moved to their own to-dos: the Pipeline chip shipped (#7317) and the live check of the E chip
ran (see *Where it stands*); left are BP166 as an estimator, Messages' *Write down their word* on a real
inbound line, the heard-day offer in Messages, and the five calls still untyped.
