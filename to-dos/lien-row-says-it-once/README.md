---
name: "Pipeline: a billed row's lien line says it once, and names the next act"
number: 325
group: gated
status: asked 2026-11-12 · the card and the mock-up the same day · nothing built · waits on Grace's four calls
summary: >
  A row in Billed Awaiting Payment or Collections prints two lien lines in its Progress & payment
  column, and they often say one thing twice: File the lien by Nov 16, 4d, then File the affidavit,
  by Nov 16, 4d. The first line is the pay runway's deadline. The second is the Accounts Receivable
  lien chip, hung under it a month later with its own day and count. The card proposes one lien line
  whose words are the next act on the lien path and whose day is the legal last day that act
  protects, a second line only for paper that is already out, a line under the rule that speaks of
  money alone, and a press that opens the Lien window on the right paper.
next: Grace's four calls, then PR 1 (trim the repeat), which fixes the row she sent on its own.
size: M as a train of five (S · M · S · M · S); PR 1 alone removes the repeat
blocker: Grace's go on the design and her four calls.
opinion: build — PR 1 is small and safe, and PR 2 fixes the cause, a bold line that asks for an act the job is not ready for
---

# A billed row's lien line says it once (#325)

Mock-up: [`mockup.html`](mockup.html), one spot, **Now** against **My suggestion**, every case drawn.
Every name, job, date and count on it is made up. Today on it is 2026-11-12.

## The ask

Grace, 2026-11-12, with two screenshots: "I don't like on the Jobs pipeline how it says file the
lien by November sixteenth, four days, and then just below it it says file the affidavit by
November sixteenth, four days. How could I improve this area so it doesn't look redundant? Can you
look at this holistically and let me know what you think we should do for all cases?"

The first screenshot is Jobs → Stages, a row in Billed Awaiting Payment. The second is that job's
Lien window, whose header says it once: **NEXT ON THE PATH** *File the affidavit — 4 days.*

## The two lines, and where each came from

They are two features laid on one spot a month apart. Both are drawn by
`BilledDatesLedger.tsx` from `buildBilledDatesLedger` (`src/lib/jobs/billedDatesLedger.ts`).

| | The first line: the clock | The second line: the paper |
|---|---|---|
| Kernel | `buildLienPayRunway` (`lienPayRunway.ts`) | `lienArChipFor` (`lienArChip.ts`) over `buildLienNextUp` (`lienNextUp.ts`) |
| Added | v2.4051 the runway · v2.4168 the dates block · v2.4205 one deadline row, bold as *File the lien* when it asks | v2.5488 as a chip for Accounts Receivable · v2.5491 hung under the row's lien line |
| Knows | The legal last day, residential or commercial, what the day counts from, and **when the money is expected**. That sets its colour and whether it asks. | **Where the paper stands on the Lien desk**: the pile, who it waits on, a hold, a gate, the mail, the attorney's letter, service. |
| Does not know | The paper, past three facts: a notice on record, a notice in the mail, an affidavit filed. | The money. It reads no pay date. |
| Covers | Every billed job with money open, at any distance. | Only a paper inside the desk's 30-day lead, or paper already out. |
| Press | The job's Lien window, on its first tab. | It works out the right door (the desk on a pile, or the window on a tab). The row does not use it. |

The second line was written to stand alone as a chip, so it carries its own day and count
(*· by Nov 16 · 4d*). Under the first line those are said again. And since v2.4205 the first line is
itself worded as the act (*File the lien*), so when the desk's next move is that same act, both
lines are the same sentence with two names for the paper.

There is a third reading of the same job: the Lien window's header (`lienTimeline.ts` through
`lienWindowNextStep.ts`, punch list #82). It says *File the affidavit — 4 days.* It knows a notice's
state (*Draft*, *Approve*, *Send*). For the affidavit it knows only the missing gates, not whether a
draft exists or is approved.

## What the board prints today

Read 2026-11-12 through a local copy of the app with every write refused. Counts only.

- 61 rows in Billed Awaiting Payment. 6 have no lien line. 28 carry a second lien line.
- 20 of those 28 second lines name the first line's own day and count. None named a different day.
- 13 are the exact pair in the screenshot. 3 of the 13 add a third line, *File the lien first*.
- 4 rows read *window closed* with *Lien gone* under the rule.
- 8 rows print the same *Nd past* twice: on *Expected*, and again beside *Ask for a date*.
- The tallest block was 7 lines.

## Every case

*Now* is what the two kernels print for made-up inputs with today as Nov 12 (the affidavit's day is
Nov 16, since Nov 15 is a Sunday). **Repeat**: both lines say one thing. **Differ**: they name
different acts, or one is wrong. **Adds**: the second line says something new.

| The job's state | First line now | Second line now | Under the rule now | Verdict | My suggestion |
|---|---|---|---|---|---|
| Nothing open, or released | none | none | none | Agree | none |
| Notice far, money due first | ○ Lien notice by Jan 15 · 64d | none | Can run late · 51d | Agree | unchanged |
| Notice far, money past or unnamed | ● **Lien notice** by Jan 15 · 64d | none | none | Agree | ● **Send the notice** by Jan 15 · 64d |
| Notice soon, no owner of record | ● **Lien notice** by Nov 16 · 4d | Needs the owner · by Nov 16 · 4d | none | Differ, day repeats | ● **Find the owner** by Nov 16 · 4d |
| Notice soon, to draft | same | Notice to draft · by Nov 16 · 4d | none | Differ, day repeats | ● **Draft the notice** by Nov 16 · 4d |
| Notice soon, waits on the leader | same | Waiting on Marisol · by Nov 16 · 4d | none | Differ, day repeats | ● **Waiting on Marisol** by Nov 16 · 4d. On the leader's screen, **Approve the notice** |
| Notice soon, approved | same | Approved · unsigned · by … or Approved · ready to send · by … | none | Differ, day repeats | ● **Sign the notice** or **Send the notice** by Nov 16 · 4d |
| Notice in the mail | same, red | In the mail · tracking owed | none | Adds | ● **Record the mailing** by Nov 16 · 4d, blue |
| Notice held by the leader | same | Held · they promised · asks again Nov 13 | none | Adds | ● **Review the hold** by Nov 16 · 4d, with the hold's reason as the second line |
| Notice soon, money due first | ○ Lien notice by Nov 16 · 4d | Notice to draft · by Nov 16 · 4d | Can run late · 2d | Differ, day repeats | ● **Draft the notice** by Nov 16 · 4d over Can run late · 2d |
| Notice window closed, nothing written down | ● Notice window closed Oct 15 · 28d ago | none (a closed row draws no second line) | Lien gone | Repeat | ● **Lien gone** · closed Oct 15, red until it is written down, grey after |
| Notice window closed, affidavit's still open | ● Notice window closed Oct 15 · 28d ago | none | Lien gone | **Differ.** The Lien window says a late notice can still go (v2.4708). | ● **Send the late notice** by Nov 16 · 4d |
| Notice sent, lien day far | ○ Lien by Jan 15 · 64d | Sent Nov 6, or *notice sent* | Can run late · 46d | Adds | unchanged, the second line reads *Notice sent Nov 6* |
| Notice sent, attorney's letter overdue | ○ Lien by Dec 15 · 33d | day 12 · the attorney's letter overdue | Ask for a date · 21d past | Adds, the money count repeats | second line kept, *Ask for a date* loses its count |
| Affidavit soon, property record not whole | ● **File the lien** by Nov 16 · 4d | Affidavit · fix the property · by Nov 16 · 4d | none | Differ, day repeats. The gate is named on hover only. | ● **Fix the property record** by Nov 16 · 4d |
| Affidavit soon, homestead answer missing | same | same words | none | Differ | ● **Answer the homestead question** by Nov 16 · 4d |
| Affidavit soon, GC's address missing | same | same words | none | Differ | ● **Add the GC's address** by Nov 16 · 4d |
| Affidavit soon, public owner | same | same words | none | **Differ.** No lien attaches, and the row asks to file. | ● **Public property, no lien**, amber, no day, with *Ask the attorney about the bond* under it |
| Affidavit soon, to draft | same | Affidavit · Notice to draft · by Nov 16 · 4d | none | Differ, and the wrong word | ● **Draft the affidavit** by Nov 16 · 4d |
| Affidavit soon, waits on the leader | same | Affidavit · Waiting on the leader · by … (the name is lost). On the leader's screen, Affidavit · Approve the notice | none | Differ, and the wrong word | ● **Waiting on Marisol** or **Approve the affidavit** by Nov 16 · 4d |
| Affidavit approved, ready to file (the screenshot) | same | File the affidavit · by Nov 16 · 4d | none | **Repeat** | ● **File the affidavit** by Nov 16 · 4d |
| The same, money expected after the day | same | same | File the lien first · 4d short | Repeat, three times | ● **File the affidavit** by Nov 16 · 4d over Money lands too late · 4d short |
| Affidavit held by the leader | same | Affidavit · Held · the leader will call first | none | Adds | ● **Review the hold** by Nov 16 · 4d, with the reason under it |
| Filed, copies not served | ● Lien filed Nov 9, green | Lien filed · serve it · by Nov 14 · 2d, red. Missing until the desk has been opened once. | none | Differ: green over red | ● **Serve the affidavit** by Nov 14 · 2d, with *Filed Nov 9* under it |
| Filed and served | ● Lien filed Nov 9 | Lien filed Nov 9 · served Nov 11 | none | Repeat | ● Lien filed Nov 9 · served Nov 11 |
| Lien window closed, nothing filed | ● Lien window closed Oct 15 · 28d ago | none | Lien gone | Repeat | ● **Lien gone** · closed Oct 15 |
| A release owed after payment | none. A paid job leaves the stage, so the row never says it. | none | none | Agree | not on this row (see *Seen, not in this card*) |
| Retainage notice due | ○ Lien by Jan 15 · 64d | Retainage · Notice to draft · by Dec 2 · 20d | Can run late · 46d | Differ: two papers, two days | ● **Draft the retainage notice** by Dec 2 · 20d. The nearest act takes the line. |
| Contracted with the owner (no notice step) | ○ Lien by Feb 15 · 95d, then **File the lien** inside three weeks | the affidavit's state, as above | as above | as the affidavit rows | as the affidavit rows |
| Commercial against residential | the day is a month later | same | same | Agree | unchanged. Kind not set: the earlier day shows, and the tip says so. |
| In Collections | the same lien lines. *Expected* turns red. | same | same | as above | unchanged |
| Several unpaid months | the earliest month still owed sets the day | the desk's earliest deadline, the same day | none | Differ, day repeats | one line, the next act, that day |

## The recommendation

**The clock gives the line its day and its colour. The paper gives it its words.**

1. **One lien line.** Its words are the next act on the lien path, in the Lien desk's words. Its day
   is the legal last day that act protects. The count shows once. When no paper is inside the desk's
   lead, the line is the quiet deadline it is today (*Lien notice by*, *Lien by*).
2. **A second line only for paper that is out**: a notice sent or delivered, a hold's reason, the
   attorney's letter, a filing day under *Serve*. It never carries a day and count the first line has.
3. **The line under the rule speaks of money only.** *Can run late* and *Nothing landed* stay.
   *File the lien first* and *Notice first* become *Money lands too late · 4d short*. *Ask for a date*
   drops the count the *Expected* row already shows. *Lien gone* moves into the lien line.
4. **The press opens the job's Lien window on the paper the line names.** The underline sits on the
   act's words alone, same colour, no ring.
5. **The tip is three short sentences**: where the paper stands, the day, where the press goes. A
   fourth only when the day is a guess (kind not set, or counted from the job's creation).
6. **One table of act words** feeds the row, the Accounts Receivable chip, the Lien desk's Do now and
   the Lien window's header, with a test that holds them together.

### The design questions

1. **One line or two?** One. The act wins the words and the deadline keeps the day. What the old
   first line said that is lost is the noun (*Lien notice*, *Lien*) while a paper is in work. The day
   beside the act still is that deadline, and the Lien window names the statute.
2. **When they differ?** The act first, with the day it protects: *Draft the affidavit by Nov 16 · 4d*.
   The Lien desk and the window header already speak this way (*Draft the Sep notice — 3 days.*).
3. **The press?** The Lien window on the right tab. It opens over the board, so closing it returns to
   the row. Its header repeats the row's sentence and holds the onward button to the desk.
4. **The tip?** Row: act, day, count. Tip: the paper's state, the day, the door. Window: how the day
   was counted, the months, the gates, the track.
5. **Consistency?** See rule 6. Today the window header says *File the affidavit* while the desk says
   *Affidavit to draft*. The shared table makes the header read *Draft the affidavit* too.
6. **The whole stack?** Order stays: Billed, Expected with *Pays in* under it, the lien line, the rule,
   the money line. The Pay calendar's *Due* line (#323) keeps its place beside *Expected*. A busy row
   drops from 6 or 7 lines to 5. The lien takes one red line, not three. On a phone a long act wraps
   as a unit and the day drops under it, so nothing is cut to three dots.
7. **What I would not change.** The v2.4205 grammar: a ring is a deadline ahead, a filled dot with
   bold words is the thing to do, one deadline at a time. The colour rule from the money. *Can run
   late* only when it adds. The Billed and Expected rows, the *Pays in* press (v2.7013). The Lien
   window's header, which is the model for the row.

**Is this the best we can do?** PR 1 removes the repeat. PR 2 removes the cause: a bold line that asks
to file when the job is not ready to file. PRs 3 to 5 make one job read one way in every place. What
this does not do is merge the two kernels. The runway and the desk stay two readers of one law, held
together by a test. A full merge is a larger job than this fault deserves today.

## Where it plugs in

- `src/lib/jobs/billedDatesLedger.ts`: the lien row's label, `sub` and the verdict words. PR #7788
  (the Pay calendar's *Due* line) edits the same kernel, so build on top of it.
- `src/lib/jobs/lienArChip.ts`: `MOVE_WORDS` and the `prefix` rule, where *Affidavit · Notice to draft*
  and *Affidavit · Approve the notice* come from, and the regex that loses the leader's name on an
  affidavit row. `LienArChip.door` already holds the right door.
- New: `src/lib/jobs/lienActWords.ts`, the act per paper and move (*Find the owner*, *Draft the
  notice*, *Draft the affidavit*, *Answer the homestead question* …), read by the row, the chip, the
  desk's rows and `lienTimeline.ts`'s `next.words`.
- `src/components/jobs/BilledDatesLedger.tsx`: the act and the day as two units that wrap, the
  underline on the act alone, the shorter tip.
- `src/components/jobs/JobsStagesTab.tsx`: `onLienDesk` passes `initialTab` from the chip's paper
  (`setLienInstrumentsModal({ job, invoice, initialTab })`, which the window already takes).
- `src/lib/jobs/lienPayRunway.ts`: takes v2.4708's rule, so a closed notice window with the affidavit's
  still open is not `closed`. The Lien calendar, the phone chip and the Dashboard's lien card read the
  runway too.
- `src/hooks/useBilledLienClocks.ts`: its read of `job_lien_filings` adds `served_at` and `serve_due`,
  so *Serve the affidavit* shows without the Lien desk having been opened.
- Guide: *read the Pipeline money view*. Glossary: *Bill dates ledger (Pipeline)*.

## The PR train

1. **Trim the repeat (S).** The second line drops its day and count when they are the first line's. It
   is not drawn when it names the first line's own act. *File the lien* becomes *File the affidavit*.
   The chip's wrong words on affidavit rows are fixed. *Ask for a date* loses its repeated count.
   No new read. This alone fixes the row Grace sent.
2. **The next act takes the line (M).** `lienActWords.ts`. Gates are named. A public owner and a
   homestead stop asking to file. The second line is kept for paper that is out. The money line's new
   words. The tip. The guide.
3. **The press lands on the right paper (S).**
4. **The row follows the Lien window on two clocks (M).** The late notice, and service after filing.
   Touches the runway, so the Lien calendar, the phone chip and the Dashboard's card are walked.
5. **One table everywhere (S).** The Accounts Receivable chip, the desk's rows and the window's header
   read `lienActWords.ts`. A test holds the four together.

## How to verify

- Kernel tests on the cases in the table above. `cases.ts` in the session's scratchpad ran both
  kernels over them and is the seed for the test file.
- A read-only walk: a local copy signed in at `/dev-login?as=1&to=/jobs?tab=stages`, every non-GET
  refused except the sign-in and the read RPCs, then count the shapes of
  `[data-testid="billed-dates-ledger"]`. After PR 1 no second line may carry the first line's day.
- 375, 768 and 1400 wide, light and dark, on the desk's rows and a Mobile card.

## Grace's calls

1. **One line with the next act first, or only trim the repeat?** My pick: the next act first. PR 1 is
   the same either way.
2. **The paper's name on the line.** My pick: *File the affidavit*, the window's and the desk's word.
   The other choice is *File the lien* everywhere.
3. **Where the press lands.** My pick: the job's Lien window on the right tab. The other choice sends a
   notice step straight to the Lien desk, which leaves the board.
4. **A closed notice window while the affidavit's is open.** The row says *Lien gone* today. The
   window says a late notice can still go, the owner's reading of 2026-10-06. My pick: the row follows
   the window. No row is in that state today.

## Seen, not in this card

- The Lien window's third tab is named *Mechanic's lien*. The row, the header and the desk call that
  paper the affidavit. A rename is its own small card.
- A job paid in full with a lien on file owes a release of record. It has left the billed stages, so
  no row says so. The Lien desk does.
- The phone's two-line rows carry a chip from the runway (*lien in 4 d*, *file first*). PR 5 can give
  it the same act words.
