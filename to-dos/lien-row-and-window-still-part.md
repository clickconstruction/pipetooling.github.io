---
name: "Lien: where a billed row and the Lien window still part"
number: 335
group: ready
status: carried from #325 when it closed 2026-11-12 · rows 1, 2, 4, 5 and 6 shipped v2.7193, v2.7187, v2.7198, v2.7184 and v2.7181 · row 1's migration pushed 2026-11-13 on the owner's yes · row 4's Dashboard card is left
summary: >
  Punch list #325 made a billed row's lien line say one thing, in the words of the next act, and
  open the Lien window on the right paper. A read-only walk of the finished train on the live board
  found places where the row and the window it opens still read differently. One of them is a rule,
  not a wording: a last day of work set by hand that is earlier than later clock hours. The row
  counts from the hand day and says Lien gone. The window counts from the later hours and gives the
  affidavit 95 more days. The rest are small wordings.
next: The Dashboard's closed-window card, as its own PR (the last part of row 4). Then the items under Also seen that wait on the owner's word.
size: M as six small pieces (S · S · XS · M · S · XS), five shipped
blocker: none
mockup: not required — words on screens that exist, and one rule in a clock
ver: v2.7042 · 7043 · 7046 · 7047 · 7048 · 7077 · 7181 · 7184 · 7187 · 7193 · 7198
---

# Lien: where a billed row and the Lien window still part

## The ask

Grace, 2026-11-12, on punch list #325: *"Can you look at this holistically and let me know what you
think we should do for all cases?"* and, of every answer, *"is this the best we can do?"*. The train
shipped as six PRs the same day. The walk that checked it pressed one lien line of each kind on the
live board, with every write refused, and read the window's header beside the row. These rows are
what still differed. Counts only are given here, since the repo is public.

## The rows

1. ~~**A last day of work set by hand, earlier than later clock hours (S, the owner's call).**~~
   **Answered 2026-11-13, shipped v2.7193.** The owner, to *which last day of work counts for the
   lien clock?*: "The day set by hand". The row's clock already read it that way, so it did not
   change. The readers that took the later of the two now follow it: the Lien window
   (`lienWindowLastMonth`), the affidavit's work period (`lienWorkSpan`) and four SQL readers
   (migration `20261113190000`, pushed on the owner's named yes). The rule is `lienClockMonths` in
   `lienLastWorkDay.ts`. The window says where later hours exist that they do not move the day.
   The fragment lists every reader. One live job fits, and it has no affidavit drafted. Worth
   counsel's eye, since the months a sworn affidavit names on such a job now end at the hand day.
2. ~~**The header for an affidavit that is not drafted or approved (S).** It reads *File the
   affidavit* at every step. The row reads *Draft the affidavit*, *Approve the affidavit* or the
   fact that holds it (*Answer the homestead question*). `buildLienTimeline` has no sentence for
   those steps. v2.7077 did the same for a notice by handing the window the job's desk entry
   (`lienWindowDeskNotice`). The affidavit needs its entry handed over the same way, a sentence per
   step and a *Waiting on* line for each.~~ **Shipped v2.7187.** The openers hand over the
   affidavit's entry (`lienWindowDeskAffidavit`). The header reads *Draft the affidavit*, *Approve
   the affidavit*, the fact that holds it (*Answer the homestead question, then file the
   affidavit*) or *Held*, each with its own *Waiting on* line. The Lien desk's own timeline reads
   the same.
3. **A held notice (XS, maybe nothing).** The row reads *Review the hold*, the act. The header reads
   *Held — the Sep notice re-asks Oct 5*, the state. Both are true. Left as it is unless it reads
   wrong in use.
4. ~~**The clock's own `closed` state (M).** v2.7047 taught the row the late notice by reading past
   the runway's `closed`. The runway still answers `closed` the day a notice window shuts.~~
   **Shipped v2.7198.** `buildLienPayRunway` answers `late_notice` for a sub job whose notice
   windows all closed unsent while the affidavit can still be filed, and `closed` only once that day
   has passed too. The Deadlines view lists such a job in the month of the affidavit's day with
   *send the late notice*, counts it as a late notice on the bar and the GC row, and keeps it out
   of Overdue and Lien gone. The Share message's past-window count leaves it out. The row and the
   phone chip read the state where they read past `closed`.
   **Left, as its own PR:** the Dashboard's card *N lien windows closed with nothing recorded … the
   lien right on that work is gone* still says gone while a late notice can go. It does not read
   this clock. It reads the Lien desk's summary (`lienDeskMissedSummary` in `lienDesk.ts`), which
   knows a window closed and not whether the affidavit can still be filed. It touches
   `summarizeLienDeskForNeedsYou` and its callers (`useLienDeskData`, the Dashboard's inputs), the
   card's words in `dashboardNeedsYou.ts`, and the Pipeline money card's *the earliest closed Sep
   15* in `lienDeskMoneyCard.ts`.
5. ~~**The phone's two-line rows (S).** Their chip comes from the runway (*lien in 4 d*, *file
   first*). It can take the act table's words (`lienActWords.ts`), as the Accounts Receivable chip
   did in v2.7048.~~ **Shipped v2.7184.** The chip reads the step and the days left, *Draft the
   affidavit · 4 d*, and opens the window on that paper's tab. A late notice that can still go reads
   *Send the late notice*, so the phone chip's part of row 4 is done. With no step to name it keeps
   the clock's words.
6. ~~**The tab named *Mechanic's lien* (XS).** The row, the header and the desk call that paper the
   affidavit. The window's third tab does not.~~ **Shipped v2.7181.** The tab reads *Lien affidavit*.
   A screen label only: no notice, affidavit or letter prints it.

## Also seen

- The rule that refuses a typed last day earlier than the clock hours (`lienLastWorkDayProblem`)
  sits oddly beside row 1's answer. A hand day that later hours follow counts, yet once those hours
  are approved the office can only clear the day or set a later one. It cannot type or correct an
  earlier day. Whether the box should allow it is the owner's call.
- The Legal desk and the firm's page never read the last day set by hand (`legalLastWorkBasis` in
  `legalLienPaper.ts`, `legalPacket.ts`, the `legal-portal` function's job columns). They date a job
  from its approved hours, else its last work date, else its creation. So counsel's page can show a
  later last day than the Lien window. It needs an edge deploy.
- The header's button for an affidavit to draft, approve or review opens the Lien desk's Affidavits
  list, not the job's row in it. The desk selects a notice from its address (`&job=`) and has no
  such read for an affidavit. The Accounts Receivable chip's door lands the same way.
- A paper that waits on someone else's approval reads *Waiting on Robert* on the row and *Approve
  the affidavit* in the header, whose second line says *the leader's approval*. A notice reads the
  same two ways. The header could name the leader.
- An affidavit approved before a fact came to hold it stays on the desk's Ready pile, because
  `pileFor` in `lienDeskAffidavits.ts` reads the paper's status before its gates. Its row, its chip
  and its header all read *File the affidavit*. The window's Lien affidavit tab lists the closed
  fact and draws no paper. The walk of 2026-11-13 found three live jobs this way, each three days
  from its last day: one with the homestead question unanswered, one marked a homestead, one on
  public property. The Lien desk's Share message already counts them as held (v2.7138). Card #305
  says a hold changes which pile a paper sits in. Whether an approved paper leaves Ready is the
  owner's call, since it takes papers off the list the office files from.
- The Lien window opened from a job's Documents tab has no desk queue to read, so its header keeps
  *Draft the notice* at every step. `JobDocumentsLienPaper` would need the job's desk entry.
- One live job has a notice drafted and waiting on approval on the Lien desk, while its window says
  no notice is required because the job is contracted with the owner. The row reads *Approve the
  notice* with the affidavit's day. It is on the desk's awaiting pile. A question for the office:
  void the draft, or correct the job's GC.
- A job paid in full with a lien on file owes a release of record. It has left the billed stages,
  so no row says so. The Lien desk does.

## Where it plugs in

- `src/lib/jobs/lienPayRunway.ts` (the row's clock), `src/lib/jobs/lienTimelineDesk.ts`
  (`lienWindowLastMonth`, `buildLienTimelineFromWindow`, `lienWindowDeskNotice`),
  `src/lib/jobs/lienTimeline.ts` (the header's sentences), `src/lib/jobs/lienActWords.ts` (the act
  table), `src/lib/jobs/billedDatesLedger.ts` (the row), `src/lib/jobs/lienCalendarRows.ts` (the
  Deadlines view).
- `src/lib/jobs/lienOneReading.test.ts` holds the row, the chip, the act table and the header to one
  step. Each row built here adds its case to it.

## How to verify

A local copy of the app signed in at `/dev-login?as=1`, with every write to the database refused.
Open Jobs, the Pipeline, *Billed Awaiting Payment*. Press a row's lien line and read the window's
*Next on the path* beside the row. For row 1, find a job whose last day of work was set by hand and
that has approved hours in a later month. The window's Escape key does not close it. Press its ×.
