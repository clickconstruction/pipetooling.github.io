---
name: "Affidavit: the months line on a job whose notice names other months"
number: 356
group: gated
status: written 2026-11-14 from a Lien desk session · the owner picked door 1 for part 2 the same day, months set by hand with counsel's reason · part 1 built as v2.7266 and part 2 as v2.7270 the same day, both on main · since v2.7302, also that day, the paper always names the month of the last day on site, so a blank is left only on a job with no last day and no month · counsel's read of the words still open
summary: >
  A short-form affidavit swears the months the job's recorded notices name, cut to the job's own
  work span. On a job with no clock hours and a last day set by hand, the span is that day's month
  alone. When the notice on record names earlier months, nothing is left and the paper prints a
  blank where its months go, with no word anywhere on why. Two drafts saved on 2026-11-14 print that
  blank. Widening the span is not the fix, because the notice's months are the property's, not the
  job's. The paper should say why the line is empty, and the office should be able to set the
  months by hand with counsel's reason, as it already can for the claim.
next: Counsel reads the words a paper with months set by hand prints, and the office walks one on a live job. Then retire the card.
size: M as two PRs (S · M)
blocker: none for the build. Counsel's read of the words before a paper with months set by hand is sworn.
ver: v2.6061 · v2.7224 · v2.7229 · v2.7247 · v2.7266 · v2.7270 · v2.7302
---

# Affidavit: the months line on a job whose notice names other months (#356)

## Where this comes from

On 2026-11-14 the dev seat saved affidavit drafts on three jobs at one property (v2.7247), under one
general contractor. One § 53.056 notice, mailed by hand for several jobs there, is recorded on each
(v2.7229). Its months are four months earlier than the jobs' last day of work, which was set by
hand to one September day on all three, in each job's Lien window.

One of the three has clock hours in the notice's first month, so its paper names the notice's
months. The other two have no clock hours. Their papers print a blank where the months go. The
owner asked: we set the last day on site in September, so shouldn't that change the months the
paper declares?

Which jobs these are is in the session notes, not here, because the repo is public. Find them with
`read_rows` on `job_lien_desk_items`: `kind eq affidavit`, `status eq drafted`, drafted on
2026-11-14 by the dev seat.

## How the line is built today

- Paragraph 5 of the short form reads *Payment is requested for work done and materials furnished
  in …* (`buildShortLienAffidavitBlocks`, `src/lib/jobsDocuments/lienFilingDocuments.ts`). A blank
  prints as the paper's blank line.
- Its months are `lienAffidavitSwornMonths` (`src/lib/jobs/lienAffidavitNotices.ts`): the months
  the live § 53.056 filings name (`months_covered`), kept only inside the job's work span.
- The span is `lienWorkSpan` (`src/lib/jobs/lienWorkSpan.ts`). Its end is the day set by hand, else
  the last clock day, else the last month's end. Its start is the first clock day, else the first of
  a first month the caller passes, else **the first of the end's month**.
- So on a job with no clock hours, setting the last day moves the end and the start with it. The
  span becomes that month alone. The owner's instinct is right that the day changed the paper. It
  changed it to September only.

## Why a wider span is not the fix

A notice mailed for several jobs at a property is one paper, and each job's filing row stores the
paper's months (`byHandFilingPayloads`, `combinedFilingPayloads`). The span exists to cut the
property's months down to the job's own. Widen it, and a job would swear months in which it had no
work. On one of the two jobs, even the month its own bill was written is not among the notice's
months.

So the blank is the record telling the truth: no recorded notice names a month this job was worked.
The owner relayed counsel's word that these jobs may rely on the notice because its total included
them. The app cannot express that today. It checks notices month by month.

## Part 1 · Say why the line is empty (S)

Wherever the paper is read before it is approved, a job whose months come out empty says so in
plain words, with the two lists side by side:

- the affidavit pane on the Lien desk and the Lien window's affidavit tab
- the help sheet that prints first in a batch
- the dev seat's `plan_affidavit_draft` reply, which today says only *no_month*

For example: *No recorded notice names a month this job was worked. Its work: September 2026. The
notice on record names April, June, July and August 2026.* It sits under the desk's *Ask the
attorney before this is filed* lead (`lienAffidavitNoticeCheck.ts`), which today stays silent on
such a job because it checks only the months the paper names.

## Part 2 · Let the office set the months, with counsel's reason (M)

Two doors, the owner's pick:

1. **Months set by hand.** As the claim set by hand works (`job_lien_claim_corrections`,
   `lienClaimCorrection.ts`): a person picks the months the paper swears, types the reason (counsel's
   word, who said it, when), and the paper prints them. The help sheet names it as set by hand, with
   the reason, and the attorney line stays.
2. **A notice relied on by its total.** On a filing recorded by hand for several jobs, a mark that
   says counsel lets each covered job rely on it whatever its months. The paper then names the
   notice's months on every covered job.

The first is narrower and keeps the record per job. The second matches what counsel said for these
jobs, but it widens what one paper proves for every job it touches. The words a sworn paper uses are
counsel's, never the app's.

## Check while here

- The desk and the Lien window build the span from different inputs. The window passes the first
  clock month (`lienWindowAffidavit.ts`). The desk's `buildLienDeskAffidavitFields` passes none. A
  job with clock hours reads the same either way, since its first day leads. A job without them may
  not. Make them one call, or show they agree.
- Since v2.7224 a job with no clock hours is dated from its bill, not its creation. Whether the
  span's start should come from the bill too is the same question as part 2, and counsel's to answer.

## Related

- #353, part 2: the To do row should say why a job with a recorded notice still owes one. Same root:
  notices are checked month by month, and the row and the paper both leave the reason unsaid.

## How to verify

- The kernel tests for `lienAffidavitSwornMonths` and the new words: a job with no clock hours and a
  day set by hand, against a notice that names earlier months.
- On the live desk, open the two drafts' Lien windows. Before part 1 the months line is blank with
  no word. After it, the reason reads beside the paper.
- Walk with a ZZ test job first: record a notice by hand for two earlier months, leave the job
  without clock hours, set its last day a month later, and draft the affidavit.

## Where it stands

Both parts are built and on main: part 1 as v2.7266 and part 2 as v2.7270, on 2026-11-14. The same day v2.7302 made the paper always name the month of the last day on site, so a job with a last day set by hand no longer prints a blank. Counsel's read of the words a paper with months set by hand prints is still open. The owner picked
door 1 on 2026-11-14: months set by hand, with counsel's reason typed, as the claim set by hand works.
