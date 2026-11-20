---
name: "Lien desk: MONTHS ON THIS JOB as one card, the ledger"
number: 361
group: close
status: written 2026-11-15 from the lien-months-refresh spike · the owner saw the before and after shots and asked for the card · Grace's go 2026-11-19 · built 2026-11-19 as v2.7989, one PR (#8990), from the card's words, because the spike's branch was gone
summary: >
  The Lien desk's MONTHS ON THIS JOB section reads as five boxes with four type systems: a bordered
  last-day bar, a half-width grid with a tinted notice column floating right, an indented claim block,
  a prose line with a link in it, then a table. A spike drew two refresh directions behind a dev flag
  and recommends B, the ledger: one card, one rhythm, the grid full width, and the money as one block
  under it with the claim as the total line and the bills as the lines that make it up. On a phone the
  claim block breaks today, and the fix for that goes in whichever direction is built.
next: The office looks at Months on this job on the live desk, at a desk and on a phone, and says what reads wrong. One call rides with that look, the head of the notice's column, under Built below.
size: M, built as one client-only PR · left, the office's look (XS)
ver: v2.7989
blocker: None. The card is built. The office's look is all that is left.
---

# Lien desk: MONTHS ON THIS JOB as one card, the ledger (#361)

## Where this comes from

On 2026-11-15 the owner said the MONTHS ON THIS JOB section of the Lien desk's notice pane looks
wrong and asked for a visual refresh worked out as a spike. The spike lives on
`claude/lien-months-refresh-spike-ae3202`: the note `docs/spikes/lien-months-refresh.md`, the
screenshots beside it in `docs/spikes/lien-months-refresh/` (before, A and B, on three live jobs,
dark and light, desktop and the 375 phone), and the prototype
`src/components/jobs/LienDeskMonthsSpike.tsx` behind `localStorage.lienMonthsSpike` (`'a'` or `'b'`,
dev builds only) with its styles in the `.lmSpike` block at the end of `src/index.css`. The owner saw
the before and after and asked for this card.

## What the section is for

It says which months this notice names, what money it claims for them, and the record behind both:
the last day of work that sets the months, the papers that already went out, and the bills that make
up the claim.

## What reads wrong today

- **Five boxes, not one.** `LienDeskMonths.tsx` stacks the last-day bar (`LienLastWorkDayLine`, its
  own border and background), a table whose tinted notice column floats at the right, the claim box
  (`LienClaimBox`) indented behind a vertical rule, a prose line holding the by-hand door, and the
  bills table (`LienClaimBills`). Each has its own spacing and edges.
- **Four type systems.** Uppercase 0.62 rem captions, 0.7 rem chips, a 1.35 rem figure, 0.75 rem
  prose and 0.8125 rem table text in one card.
- **The money is told twice and tied to nothing.** The claim figure sits under the grid at the left;
  the bills sit a section lower with OWED at the far right; neither lines up with the notice column
  that carries the same figure.
- **A paragraph above the grid** explains the grid every time.
- **The phone breaks the claim block.** `LienDeskMonths.tsx` sets the body's two columns inline
  (`gridTemplateColumns: 'auto minmax(0, 1fr)'`), which beats the container query that stacks them, so
  the by-hand door and the notes squeeze into a column a few characters wide.

## The change: B, the ledger

One card with one rhythm, as the spike's `'b'` draws it:

1. **The last day of work is the card's first row**, with no box of its own: the caption, the day,
   the source chip, Change › at the right, a hairline under it.
2. **One lead line** replaces the paragraph: "Tick a month to put it on this notice." and, only when
   an earlier paper exists, "A check is a paper that already names the month."
3. **The grid runs full width**, every row sharing the head's column widths (CSS subgrid in the
   prototype; a table with the same classes is the fallback). Month and its hours line, the window on
   one line where it fits (a chip only where a state changes: mail by, closed, not noted, skipped, not
   a work month yet; the rest faint words), one quiet column per earlier paper, the notice column last.
   A missed window keeps its red tint and gains a red left bar. The Windows view's spent bar stays.
4. **The notice column stays quiet**: a tinted head with a 2 px blue top and the figure faint, a tint
   on the ticked cells only, so a tick visibly changes the thing it changes.
5. **The money is one block under the grid**: the claim as the total line (caption at the left, the
   figure large at the right edge, Still unpaid on this job and Correct the claim › under the caption),
   the bills as the lines that make it up with BILLED, PAID and OWED on the same right edge, Not billed
   yet with Bill it from here › as the last line.
6. **The quiet rows close the card**: the retainage line with Set on the job ›, "A paper that went out
   by hand becomes a column here. Record it…", the several-months note, the information and late notes,
   and the affidavit's state when the desk passes one.
7. **On the phone** the month and its window stack in one column, earlier papers show as "A ✓" marks,
   the notice's tick stays at the right edge, and the bills keep their OWED column alone.

Every door keeps working: tick a month, Change ›, Correct the claim ›, Record it…, Set on the job ›,
Note it as missed, Bill it from here ›. No words a first-timer reads change beyond the lead line.

## What the build does beyond the prototype

- The spike's CSS overrides move into the composed components: `LienLastWorkDayLine` takes a `flat`
  prop instead of the `!important` override on its bar; `LienClaimBox`'s read view takes the ledger's
  two-column layout as its own class; `LienClaimBills` drops its dashed rules for the card's hairline.
- The empty state ("No months on this job yet.") goes through `EmptyState`.
- The existing `data-lien-*` hooks stay (`data-lien-grid-row`, `data-lien-claim-bills`,
  `data-lien-desk-by-hand`, `data-lien-desk-note-missed`): the gates' "The bills ↓" press and the
  tests find the section through them.
- The spike's flag, `LienDeskMonthsSpike.tsx` and the `.lmSpike` block go; the spike branch is not
  merged.
- A render smoke for the card and a help-guide check: the Lien desk guide's words about the months
  grid still hold, so no guide change is expected.

## Why not A, the rail

A draws the claim figure large in the notice column's head over the ticks. It ties notice, months and
money in one glance, but the pane's sticky head already says "Aug + Sep · $29,323 · 1 of 2 bills" one
line above, so the rail repeats it and pays with a three-line head row and a figure drawn twice. B
puts the one thing the section adds, the record behind the claim, in one block that reads in order,
and is the cheaper build.

## Built: v2.7989 (#8990, 2026-11-19)

One PR, client only. The fragment is `docs/recent-features/v2.7989.md`.

- **From the card's words.** The spike's branch, its note, its shots and its prototype were on no
  branch, worktree or remote when the build started. B was built from the seven points above, so
  there is no side-by-side with the spike's `ledger-*` shots.
- **Laid over v2.7430 and v2.7446**, which this card did not know. A closed month is still one line,
  what a missed window costs is still said once under the grid, and the total is still at the foot of
  the notice's column. That foot is now the claim's own line, so the figure is said once.
- **The by-hand line keeps its words** as they were. Point 6 above quotes a reworded line, and the
  rule under point 7 says no words change beyond the lead line. The rule won.
- **One call went up.** Point 4 puts the claim figure faint in the head of the notice's column.
  v2.7430, the office's pick of 2026-11-15, took the figure out of the head. The build keeps the head
  as the name alone. The choice was sent to the lead session for Grace, and the head is one line to
  change if the answer is the figure.
- **The phone.** The grid no longer slides. Each month sits over its window, an earlier paper is a
  mark like A ✓, and the tick has a column of its own at the right edge.

## How to verify

Open `/lien-desk?tab=notices` and pick three notices: one with several missed windows and an open
month, one whose month is dated from the bill, and one with an earlier paper A and a closed month
that still offers Note it as missed. Look in dark and light, at a desk and at 375 wide. Tick an open
month on a draft and the line under the claim's figure follows. Press each door and its window
opens. Nothing is saved by looking.
