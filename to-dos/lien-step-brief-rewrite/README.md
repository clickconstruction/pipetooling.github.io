---
name: "Lien desk: the step brief rewritten for a first-week employee — the attorney's letter, one courtesy, the affidavit's week, a dated timeline with payments"
number: 274
group: waiting
status: decided 2026-11-06 with Grace over five passes of one board · PR 1a the rename sweep (v2.6591) · PR 1b the words and the two policy changes · PR 2 the dated timeline with payments · the owner's calls listed below
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
| 2 | `LienReminderScheduleStrip` → a vertical `LienNoticeTimeline` per notice: day 0 from letter two's clock (`clock.why`), the affidavit's day from the desk's affidavit entry, today, the windows, payments from the job's payments under `attributeJobPayments` with the remainder, *paying it down* (a payment after the packet pauses `courtesyStatus` / `letterTwoStatus` until the promised date or a week), the status pills, *Show another*, the counts chips from `courtesy.reason` grouping; § Rules keeps a schedule strip with no marks. Verify first that the server's affidavit list drops a job at zero balance. | Fresh main after 1b. |

## Where it was built

Session worktree `lien-deadlines-bills-170aad` (Grace, 2026-11-04 to 06). Memory stream `lien-reminders-strip-stream`.

## The mock-ups in this folder

Copies of the four boards above, kept here so the card stands without the chat links. Every job, customer, street and amount in them is made up, and the live screenshots in their *Now* columns are left out (the repo is public); the private boards keep both.

- `mockup.html` — the decision board, the fifth pass of 2026-11-06: Reminders step 3, Affidavits step 1, Notices step 3, then section 1b *When money comes in* (a partial payment and paid in full), then every rung's words before and after. **PR 3 builds section 1b's partial payment.**
- `earlier-step-brief.html` — the step brief that replaced the fade (v2.6574, every rail v2.6577).
- `earlier-reminders-ladder.html` — the owner's explainer of the Reminders ladder (#262), with the walker that moves one notice up the rungs.
- `earlier-lien-desk-header.html` — the desk's header board (one tool row, the leader's FYI as a chip), shipped separately.

## Picking up PR 3 (hand-off, 2026-11-06)

**Where it stopped.** A session read the kernels on top of PR 2's branch and was stopped before writing code, on Grace's word, so this card could carry it. Nothing of PR 3 is committed. No answer from Taunya on the two calls is recorded anywhere: build the defaults in the table above and name both in the release note so she can change either.

**Start** from fresh `main` once PR 1b (#7145) and PR 2 (#7146) have landed; claim the version with `npm run claim`. Read PR 2's fragment first: its timeline already draws the payment rows and the remainder.

**The ask, as briefed.**

1. `courtesyStatus` and `letterTwoStatus` take the job's payments since day 0 (the packet). A payment after the packet that leaves money owed puts the courtesy in a new state `paying` (words *paying it down · $4,000 paid Nov 3 · $8,045 still owed*) until the promised date on the notice when there is one, else `COURTESY_AGAIN_DAYS` after the payment. While `paying`, `courtesyIsDue` is false and the Do now row's usual press is *Record what they promised*. Letter two stays `due` / `overdue` on its own clock, but the Do now row leads with the promise press while the courtesy is `paying`; the footer keeps *Send the attorney's letter ▸* plain, not amber, with a title saying the office may still send it when the payment was token. The legal day never moves; `affidavit_week` still wins inside the week.
2. *Record what they promised*: a press on the sent notice's footer and on the Do now row that records a promised date and an amount for the rest onto the sent item. The desk asks again on that date: the courtesy returns to `sent`, the letter to its clock.
3. `lienReminderAt`: `paying` stands on step 2 (*Reminder sent*) with state `paying`. `lienReminderBrief(2)` gains the board's paying words: *They have started paying. A partial payment is an answer, so the desk stops reminding and asks what they promised for the rest. The lien's last day does not move.* The timeline's today row (`lienTimelineTodayWords`) reads *They are paying it down. The attorney's letter waits while they pay.* and the payment row's next line reads *reminders paused until <date>*.
4. Tests on the three kernels and the render smokes in `LienDeskNextUp.render.test.tsx` and `LienDeskModal.render.test.tsx`; the guides `send-a-courtesy-notice-before-a-lien` and `read-the-reminders-ladder-on-the-lien-desk` gain a short *When they pay part of it* section in plain words; release note + fragment; `docs/twins/APP_DIRECTORY.md` line 89 (the courtesy notice's line) names the new press.

**Where it plugs in** (line numbers as of PR 2's branch):

- `courtesyStatus` (`src/lib/jobs/lienCourtesyNotice.ts`) reads in this order: nothing out → closed (paid, the GC's okay, the owner's call, filed, a reply) → held (`lienLineBlockedReason`) → `affidavit_week` → sent / waiting / due. It takes no payments today. `paying` goes after `affidavit_week` and before the sent branch. `courtesyIsDue`, `courtesyMaySend` and `courtesyFooterSentence` each need a `paying` case.
- The courtesy map is built in one place, `courtesyByJobFrom` (`src/lib/jobs/lienCourtesyDesk.ts`), called from `LienDeskModal.tsx` (~654) and `useArLienChips.ts` (~91). That is where the payments come in. Its `openBalance` is revenue less payments made.
- Payments: `paymentsByJob` on the desk data (`src/hooks/useLienDeskData.ts` ~283–292), `{ amount, paidOn }` oldest first; optional, so the AR chips' reader may not have it. Day 0 is `letterTwo.clock.at` (an ISO stamp; take its app-time day with `calendarYmdInAppTzFromIso`).
- `letterTwoStatus` (`src/lib/jobs/lienLetterTwo.ts`) is built by `letterTwoByJobFrom` (`useLienDeskData.ts` ~301). The brief keeps its states; only the Do now row's lead and the footer's tone change. Decide whether it needs the payments at all.
- The Do now row: `src/lib/jobs/lienNextUp.ts` ~232–244 picks the courtesy row or the letter-two row; `BUTTON` ~102. A paying row needs its own action (say `promise`) with the button *Record what they promised*, mapped to the REMINDERS rung by `lienStepOfRow` (`lienNextUpSteps.ts`) and given a beside-card in `besideItems`.
- The rung: add `paying` to `LienReminderState` in `src/lib/jobs/lienReminders.ts`; in `lienReminderAt` it goes after the closed / in-flight / held / `affidavit_week` branches. `lienReminderWhy` and `lienReminderLadderItems` each need a paying line.
- The timeline: `lienNoticeTimeline` and `lienTimelineTodayWords` (`src/lib/jobs/lienNoticeTimeline.ts`) take a new fact, the day the pause ends, for the payment row's next line. Built in `LienDeskModal.tsx` ~661–686.
- The footer: `LienDeskModal.tsx` ~3253–3262 holds the sentence, *Record the owner's call…*, *The GC authorized direct pay…*, the courtesy door and the attorney's letter door (amber when `letterTwoIsDue`). The new door sits beside *Record the owner's call…*.
- The promise: there is no `fields.promise` on a sent item yet. The sent item's `fields` already carry `courtesy` (written by `withCourtesyRecord`), `ownerCall` and `gcAuthorizedDirectPay` (read by `parseLienNoticeSentFacts`, `src/lib/jobs/lienNoticeDraft.ts` ~281). The pre-send hold's promise is the job's promised pay date, `PromisedPayDate { promisedYmd, markedByName }` from `list_job_promised_pay_dates`, written by `set_job_promised_pay_date(p_job_id, p_date)` (`SetPromisedPayDateModal.tsx`, `paymentChaseIo.ts`). **Decide first:** write the date through `set_job_promised_pay_date` so the Stages board, the forecast and the desk's pre-send hold read the same promise, and keep only the amount and the note on `fields.promise`; or keep the whole promise on `fields.promise`. Either way no migration is needed. If one turns out to be needed after all, it gets `SET lock_timeout = '3s';`, the three fence calls and its `docs/migrations/` note.

**Verify.** `rm -rf .cache/typecheck` then `npm run typecheck`; lint; the desk's render suites; `node scripts/theme-tokenize.mjs --check src` and the word checks; walk it on the worktree's dev server. Prod has no partial payment on a sent notice to walk, so seed one under BEGIN / ROLLBACK or ask before writing a ZZ row: prod writes need the owner's yes.
