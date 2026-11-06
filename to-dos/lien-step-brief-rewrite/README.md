---
name: "Lien desk: the step brief rewritten for a first-week employee — the attorney's letter, one courtesy, the affidavit's week, a dated timeline with payments"
number: 274
group: waiting
status: decided 2026-11-06 with Grace over five passes of one board · PR 1a the rename sweep (v2.6591, #7142) · PR 1b the words and the two policy changes (v2.6594, #7145) · PR 2 the dated timeline with payments (v2.6596) · PR 3 the paying-it-down pause waits on the owner's calls below
summary: >
  v2.6574 and v2.6577 gave a pressed rung on Do now a step brief and sorted the list instead of
  fading it. Reading the briefs as a new employee would, Grace found them telling rather than
  showing: an axis of day numbers with no date, no sign of what starts day 0, rules written from
  the system's side, and the other moves as bare names. Five passes of one board settled the shape:
  six parts in the same order, a vertical timeline of one real notice with today on it, every row
  saying what happens next, payments as rows, and words a first-week employee can read. Along the
  way four policy calls fell out: letter two is renamed the attorney's letter on every surface; one
  courtesy reminder, never a second; the seven days before the affidavit's day are the affidavit's
  week, a priority and not a hold; a partial payment pauses the reminders as paying it down.
next: PR 1a merges alone (a mechanical rename, cut from main); PR 1b and PR 2 follow on fresh main. Taunya confirms the three defaults below.
size: S (1a) · M (1b) · M (2)
blocker: none for 1a; 1b and 2 want Taunya's word on the defaults, and build on hers if she changes one
ver: v2.6591
opinion: build — every piece reads data the desk already holds; nothing is sent, held or approved differently until she says so
---

# Lien desk: the step brief rewritten for a first-week employee (#274)

## The board

https://claude.ai/artifact/LkWfqsVWtADmUGqrjmq7CU (private; Grace shares it). Now is the live render of v2.6577; My suggestion is drawn at the same width. Three spots: Reminders step 3, Affidavits step 1, Notices step 3; then section 1b, a partial payment and a payment in full; then every rung's words before and after.

Earlier boards: the explainer for the owner https://claude.ai/artifact/R9TCeLBJT5B2gcHuCnhgvy, the step-brief reframe https://claude.ai/artifact/A92ZYre91y5ByFCSnkayxn, the header https://claude.ai/artifact/5f3w8v2PeQRbrU8yVSJh6W.

## The decisions, in the order they were made (2026-11-06)

1. **Show, don't tell.** A pressed rung opens a brief with six parts, always in this order: *In plain words* · the notice's own dates with today on them · *Why these N are here* as counts from the notices on the step · *What to do now* with the press and what it does · *If that is not right*, each other move with a one-line meaning · *If nobody acts*, with dates and the days left. The axis of bare day numbers goes.
2. **Day 0 is named by its date and its source.** The day the run recorded the mailing, or the day USPS accepted or delivered it when the envelope's tracking knows better.
3. **Vertical, not horizontal.** One row per event or window in date order: date · marker · words · kind chip · status. Nothing shares a line, so nothing overlaps, and it reads the same on a phone.
4. **Only events get a dot.** The notice mailed, today, the law's last day. A span of days we chose is a dashed bar: the courtesy window, the attorney's letter's window, the affidavit's week. "Letter two is late" is a label changing, not an event.
5. **Today is a band across every column** with the diamond on the rail, *You are here*, the one press, who presses it and what it does, the fallbacks, and a vertical *action needed*.
6. **Every row's status says what happens next.** ✓ done · 23 days ago, the clock started / open · optional · 3 days left to send it, after Nov 9 the desk asks for the affidavit / late · act now · 9 days past the window, it still goes, weaker each day / starts in 3 days · on Nov 9 the button here becomes Draft affidavit / deadline · in 10 days · miss it and the lien is lost for good. Never *no action · the desk switches by itself*.
7. **The kind chips read in plain words**: *legal requirement* (red), *courtesy notice*, *attorney's letter*, *our rule*, *our gate*, *payment*. Never *law* / *ours* / *counsel*.
8. **One courtesy reminder, then the attorney's letter.** The desk never offers a second courtesy as a step. The press stays on the notice's footer for a resend by hand (a bounced channel). Rung 2 becomes *waiting a week for an answer, then the attorney's letter*.
9. **The affidavit's week is a priority, not a hold.** Inside the 7 days before the affidavit's day the desk's recommended action becomes the affidavit (draft · the leader signs before a notary · file at the county); the courtesy's press stays on the footer. The legal holds — a homestead, no approved work month, a closed window — stay holds with their reasons. The old sentence "a reminder must never name a lien day that is about to pass" was the wrong reason and is gone.
10. **Days 7, 10 and 14 are policy, not law**, and the brief says whose: day 7 the owner's choice (Nov 1), 10 to 14 counsel's memo of Sep 22, the two 7-day margins ours. Ask counsel whether 10 to 14 was a window or a due day and an overdue day.
11. **A payment is a row; a partial payment is an answer.** A green row with the amount and the remainder from the one-payment rule; *paying it down* pauses the reminders and makes the usual move *Record what they promised*; the attorney's letter waits (the office may still send it when the payment was token); every later amount is the remainder; the legal day never moves. Paid in full closes the ladder, strikes the deadline through, and points at *Release the lien* when an affidavit is on file.
12. **Rename letter two → the attorney's letter on every surface a person reads.** The rung *Attorney's letter*, the press *Send the attorney's letter*, the footer, the row words, the Dashboard's lien card, § Rules, the guides. Code names stay (`lienLetterTwo.ts`, `letter_two`, `LETTER_TWO_*`). Reason: once the second courtesy was dropped, "letter two" read as a second copy.
13. **Remove *Refer to the Legal desk* from the affidavit brief's other moves** (Grace, Nov 6).

## The owner's calls (defaults built unless she says otherwise)

| Call | Default built | Why |
|---|---|---|
| A second courtesy reminder? | No. One, then the attorney's letter. | The second lands at day 14, on top of counsel's letter; silence after one nudge means escalate. |
| How long a partial payment pauses the reminders | Until the promised date when they give one, else a week. | The affidavit's week and the lien's day are never paused. |
| Does the attorney's letter ever go to someone who is paying? | Not by the desk's hand. | The office may still send it when the payment was token; the brief says so. |
| The schedule's days as settings | A later card. | PR 2 reads every day from one place so it is small. |

## PRs

| PR | What | Notes |
|---|---|---|
| 1a · v2.6591 | The rename sweep: `scripts/codemods/attorneys-letter-rename.mjs` over `src/**/*.ts{,x}` and `src/content/help/*.md` (strings, JSX text, guide prose; never identifiers, comments, release notes or fragments); the tests' expected words; `docs/GLOSSARY.md` amended. | Mechanical; merges alone from fresh main before 1b. |
| 1b | `lienStepBrief` / `lienReminderBrief` rewritten to the board's words with `instead` as `{ press, means }`; `LienStepBrief` gains *In plain words* and *If nobody acts*; one courtesy (`courtesyStatus` never `due` again after a send; rung 2 words); the affidavit's week as a priority (`courtesyStatus` returns a new `affidavit_week` state, not `held`; the Do now row recommends the affidavit; the footer keeps the press); *Refer to the Legal desk* out; guides; `lienReminderSchedule` source lines (*Day 7 is the owner's choice*). | Fresh main after 1a. |
| 2 · v2.6596 | `LienReminderScheduleStrip` → a vertical `LienNoticeTimeline` per notice: day 0 from letter two's clock (`clock.why`), the affidavit's day from the desk's affidavit entry, today, the windows, payments from the job's payments under `attributeJobPayments` with the remainder, *paying it down* (a payment after the packet pauses `courtesyStatus` / `letterTwoStatus` until the promised date or a week), the status pills, *Show another*, the counts chips from `courtesy.reason` grouping; § Rules keeps a schedule strip with no marks. Verify first that the server's affidavit list drops a job at zero balance. | Stacked on 1b. **Shipped without the pause:** the payment rows and remainders are in; *paying it down* / *Record what they promised* moved to PR 3. |
| 3 | *Paying it down*: a payment after the packet pauses `courtesyStatus` / `letterTwoStatus` until the promised date or a week; the usual move becomes *Record what they promised* (a promise record on the sent notice); the attorney's letter waits unless the office sends it by hand. Needs Taunya's two answers below. | After 2, with the owner's word. |

## Where it was built

Session worktree `lien-deadlines-bills-170aad` (Grace, 2026-11-04 to 06). Memory stream `lien-reminders-strip-stream`.
