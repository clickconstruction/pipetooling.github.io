---
name: "Lien desk: a sent notice hides the next months to draft, and its gates judge a notice that already went"
number: 248
group: ready
status: claude/248-lien-sent-pile-c5c64d · the owner picked A for both faces 2026-11-07 · PR 1 (the pile and Do now) and PR 2 (the gates fold) in flight
summary: >
  The desk's queue puts a job in Sent · 30d whenever a notice went out inside thirty days, before it
  asks whether new months are due. Job 650 on 2026-11-02: Aug + Sep due in 14 days, the path says
  "Draft the Aug + Sep notice", the row sits in Sent with letter two's doors and no draft door, and
  the Dashboard's draft count leaves it out. The same entry's gates judge a notice that already went.
next: Both PRs merge, a ZZ Test walk, then delete this card.
size: M for the pile (the kernel's pile order, Do now's rows, the pane's footer carrying both the draft door and letter two's) · S for the gates
blocker: None — the owner's call is in (A and A).
ver: v2.3405 · 4583 · 6261
opinion: build the pile change — a month's notice is a statutory deadline and the courtesy and letter two can ride on the To draft row; the gates on a sent notice can fold to one line.
mockup: not required — the rows and the gates exist; the change is which pile a row sits in and the words on the gates
---

# Lien desk: a sent notice hides the next months to draft, and its gates judge a notice that already went (#248)

## The ask

The sweep after Taunya's report on job 890 (2026-11-02) walked the Sent · 30d pile as the dev
and as the sample assistant. Two things on it need the owner's call before a PR changes them.

## Face one: the pile order hides the next months

`buildLienDeskQueue` decides a job's pile in this order: a live item (drafted, awaiting, approved,
held) wins; else a notice sent inside thirty days puts the job in **Sent**; else months due put it in
**To draft** or **Needs the owner**; else a closed month puts it in **Missed**.

Job 650 · ATI Schertz on 2026-11-02, as the assistant sees it:

- The row sits in Sent · 30d: *due in 14d · Jul window closed · not noted · Aug + Sep · sent Oct 14 ·
  day 19 · letter two overdue*. The money is $1,000.
- The pane's path reads **Draft the Aug + Sep notice — 14 days. WAITING ON us — the notice to be
  drafted and mailed.** The gates read *Ready to go out · All 4 clear*.
- The footer is the sent footer: *Record the owner's call…*, *The GC authorized direct pay…*, *Send a
  courtesy notice ▸*, *Send letter two ▸*. There is no **Send for approval** and no draft door.
- Do now shows letter two for 650 and no draft row (`lienNextUp`'s `sent` case pushes only the
  courtesy and letter two). The Dashboard's draft count (`summarizeLienDeskForNeedsYou`) reads only
  the To draft and Needs the owner piles.

The Oct 14 run could not have carried Aug + Sep: on Oct 14 the months RPC looks thirty days ahead and
Aug's Nov 16 was 33 days away. So every job that gets a notice near a deadline sits in Sent while the
next month's window runs down, and moves to To draft only when the sent item ages out, on Nov 13 for
650, three days before Aug's window closes.

The Deadlines list and the Calendar read the months, not the pile, so they still name Aug and Sep.
The desk's own piles, Do now and the Dashboard count do not.

### The rule to pick

- **A.** A job with months due goes to To draft whatever went out before. The sent facts stay on the
  row (the letter two chip and the courtesy chip are per job already), and the To draft pane's footer
  carries letter two's and the courtesy's doors beside Send for approval. Do now shows the draft row
  and the letter two row for the same job. Sent · 30d keeps only jobs with nothing due.
- **B.** The row stays in Sent, and the sent pane gains the draft: the months grid's ticks and a
  **Send for approval** door under the sent footer. Do now adds a draft row for a sent job with months
  due. The Dashboard count adds them.
- **C.** Leave the piles; make the run look further ahead so the next month rides the same packet.
  Weaker: a month whose window opens after the run still waits.

The opinion is A: the pile names what the office must do next, and a statutory notice outranks a
reminder letter.

## Face two: the gates on a notice that already went

A Sent row's pane still draws **The four gates** with a verdict, as if a notice were about to go. On
890 (every window closed, nothing left to notice) the verdict read *Can't go out yet · 3 blockers*
and sent Taunya to **Set the GC ›** on a job with a GC. v2.6376 and v2.6380 fixed the GC and the
money; gate 4 still reads *No month picked · Tick at least one month below* over an empty grid, and
the verdict still says the notice cannot go out.

### The rule to pick

- **A.** On a Sent row with nothing due, the gates fold to one line: *Sent Oct 14 · the owner, the
  GC, the kind and the months as the notice named them*, with *Details ∨*. No verdict.
- **B.** Keep the gates and give gate 4 honest words when no month is open: *No month open · every
  window has closed* (a small PR; PR #6854's words do this much).
- **C.** On a Sent row with months due (face one, rule A or B), the gates judge the next notice, as
  they do today for 650.

## Evidence

Read live on 2026-11-02 as the dev (`robert@`) and as `sample-assistant@` through a headless
sign-in: the same fifteen RPC rows, the same seven GC rows, the same forty-three items for both, so
no role sees a different pile. 890's rows: `jobs_ledger` 5b5ee5e4 (gc 9c6e91d5 RMC- Dudley Mason,
`lien_last_work_on` 2026-08-15, revenue $285, status billed), one sent item (months 2026-08, sent
2026-10-14 by the GC's rule), no row from `list_lien_notice_months` (Aug's Oct 15 deadline is more
than a week past, the month noticed).
