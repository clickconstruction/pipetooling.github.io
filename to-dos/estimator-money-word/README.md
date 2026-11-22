---
name: "The estimator's word on money: the leftovers"
number: 129
group: close
status: BUILT 2026-11-21 — every leftover is built or walked: the five untyped calls typed (v2.8214), the heard-day offer under a customer's own text or voicemail in Messages (v2.8255), Messages' *Write down their word* walked on a real inbound line on the dev server the same day (under *Where it stands*), and the owner's yes of that evening built, a promise saved from a line marking the line (v2.8268 the function, pushed; v2.8271 the client); before that, the owner's three calls of 2026-11-08 built or held (#7316 v2.6694 with its migration pushed, #7317 v2.6695) and the train of 2026-10-19/20 (v2.5646–v2.5651, v2.5655–v2.5659, v2.5668, v2.5670) live; left: the owner's look at a day beside the press on a real text, and his word to retire
ver: v2.6694 · v2.6695 · v2.8214 · v2.8255 · v2.8268 · v2.8271
summary: >
  The estimator who sold a job can now see its money and write down the customer's word on
  paying, from the won bid, the Money lens, the Dashboard and the customer's line in Messages.
  A word that they paid meets the deposit at allocation, or comes back to whoever heard it after
  a week. A primary's paid verbs hold to their own jobs. Since 2026-11-08 the estimator who wrote
  a signed estimate is one of the job's people too, with a red E beside their name, and the office
  sees a paid claim on the Pipeline's Billed row. Since 2026-11-21 a day the customer names in a
  text or a voicemail is filled in when their word is written down from Messages, and a promise
  saved there marks the line it came from. This to-do keeps what is left: the owner's look at
  that, and his word to retire.
next: The owner's look, then his word to retire. In Messages, open a customer's thread where their own text or voicemail names a day still ahead: *They said* and the day sit beside **Write down their word**, and the press opens the sheet with the day in **Pay by**. Save it, and the job's **They promised** row names the day. No real line named a day still ahead on 2026-11-21, so the look waits on one; the render tests prove the drawing until then.
size: XS each
blocker: the owner's look and his word to retire; every call is answered (2026-11-21)
opinion: retire after the look
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
  reads as *J878 opened from this bid*: job 878 *Tune 5- Seguin* at the bid's address, with its four supply-house rows.
  The words themselves were not rendered, since rendering them means pressing Imitate in the owner's Chrome; the row the
  chip reads is visible to the estimator, which is what the check asked.

- **Write down their word on a real inbound line** (2026-11-21, the dev server as the dev, prod data): a
  customer's thread in Messages with four lines of their own, two texts and two missed calls. Each carries
  **Write down their word** under it. The press under the newest text read the customer's jobs and opened
  the sheet on their one job with money open, a ZZ TEST job, with the customer's name in *Who said it* and
  **Text** picked. A promise for Nov 27 saved (*Promise saved.*); the sheet opened again read *Nov 27 · on
  the board* with who said it, by text and who heard it. **Never said that** took it off the record and off
  the board, and the sheet read empty again. What stays is the voided row, which no press deletes. An
  October text of theirs names a weekday that has gone by, and draws no day beside the press, as built.

Left on the card: the owner's look at a day beside the press on a real text, and his word to retire. The five calls still untyped were typed on 2026-11-21 (v2.8214), and the heard-day offer was
built the same day (v2.8255), both under *The follow-ups*.

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

Answered 2026-11-21.

- **A word written from a line also marks the line's promise — yes** (*Yes, build it*). A promise saved
  through the sheet is the Pipeline's (`job_payment_promises`), as since v2.5649, and now the line it was
  written from keeps the day too: `write_down_payment` (v2.8268, `20261122024419_write_down_payment.sql`,
  pushed) writes the line's `message_promises` row as a payment by the day saved, and the client calls it
  after the sheet saves (v2.8271). The job's **They promised** row names the day, and the thread reads
  *Their move · until Fri Nov 27 · payment* once our word is the newest. **Never said that** takes the mark
  back off. A refused mark is said in words and leaves the Pipeline's promise standing. Walked
  2026-11-22 on the dev server as the dev, after the push: a promise for Nov 27 saved from a test
  customer's text on a ZZ TEST job turned the thread's chip to *Their move · until Fri Nov 27 ·
  payment* and the job's **They promised** row to *promised a payment by Fri Nov 27*, and **Never
  said that** put both back.

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
  for the office alone since v2.5670). BP166 was read as an estimator on 2026-11-09, and *Write down
  their word* under a customer's line in Messages was walked on a real inbound line on 2026-11-21
  (both under *Where it stands*). No
  surface opens the read-only Job Detail pane for an estimator.
- **The heard-day offer in Messages.** Built 2026-11-21 (v2.8255). When a customer's own text or
  voicemail names a day that has not gone by, *They said* and the day sit beside **Write down their
  word**, and the press opens the same sheet on *They'll pay by…* with the day in **Pay by** and a
  line saying where the day was read from (`heardDayOnLine` in `messages/wordFromLine.ts`, over the
  voicemail reader's `daySaidIn`). A call's summary and an email draw no day, since their words are
  not the customer's alone. The day is an offer and writes nothing. Cut 2's offered row, a
  voicemail's *Keep the day* and `write_down`'s chooser are still on no screen; the payment mark
  itself is written since v2.8271 (under *The owner's calls*).
- **The untyped calls.** Done 2026-11-21 (v2.8214). The seven new functions are in
  `src/types/database.ts` since v2.5656; the client called them `as never`. `list_paid_claims` is
  typed since PR 2 (v2.6695), and `is_job_people` has no caller in the client. The other five are
  typed at every call: `list_bid_money_strip`, `list_my_money_strip`, `list_customer_money_strip`,
  `list_job_payment_promises_for` and `add_job_payment_claim`. The one call the real type disagreed
  with was the claim's: the sheet sent `null` for an amount, a name or a note left empty, and now
  leaves them off, so the function's own `DEFAULT NULL` writes the same row.

## Retire when

The three calls are answered and built or declined (done 2026-11-08), and the four follow-ups are
shipped or moved to their own to-dos: the Pipeline chip shipped (#7317) and the live check of the E chip
ran (see *Where it stands*), BP166 was read as an estimator on 2026-11-09, the five untyped calls
were typed on 2026-11-21 (v2.8214), Messages' *Write down their word* was walked on a real inbound
line the same day, and the heard-day offer in Messages was built (v2.8255). Every condition is met.
What is left is the owner's: his look at a day beside the press on a real text, and his word to
retire.
