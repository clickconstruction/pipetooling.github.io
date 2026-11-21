---
name: "Lien desk: MONTHS ON THIS JOB as one card, the ledger"
number: 361
group: close
status: written 2026-11-15 from the lien-months-refresh spike · the owner saw the before and after shots and asked for the card · Grace's go 2026-11-19 · built 2026-11-19 as v2.7989, one PR (#8990), from the card's words, because the spike's branch was gone · live 2026-11-20 and walked read-only the same night · the walk's Record it… gaps built 2026-11-20 as v2.8026 on Grace's pick, and a missed notice's closed months offered to tick as v2.8027 on her yes · audited 2026-11-20 by a Fable 5.2 session, with three faults fixed as v2.8063, v2.8064 and v2.8074 · the owner's five answers of the same day built as v2.8115 (#9134), v2.8116 (#9130) and v2.8119 (#9133), live 2026-11-21 and walked read-only · the walk's one more dead tick column, on a missed notice with nothing due, fixed as v2.8125 (#9148) · the walk's two older oddities, a sent notice with no month in its strip and a late missed notice that said the lien right was gone, fixed 2026-11-21 (#9211, #9215)
summary: >
  The Lien desk's MONTHS ON THIS JOB section reads as five boxes with four type systems: a bordered
  last-day bar, a half-width grid with a tinted notice column floating right, an indented claim block,
  a prose line with a link in it, then a table. A spike drew two refresh directions behind a dev flag
  and recommends B, the ledger: one card, one rhythm, the grid full width, and the money as one block
  under it with the claim as the total line and the bills as the lines that make it up. On a phone the
  claim block breaks today, and the fix for that goes in whichever direction is built.
next: The office looks at Months on this job on the live desk, at a desk and on a phone, and says what reads wrong. One open choice for Grace rides with that look, the figure in the head of the notice's column, under Built below. Grace should also hear that Record it… on a missed notice now opens with no paper picked and no month ticked, the owner's answer of 2026-11-20, since it changes how her v2.8027 opens. Grace and the owner should hear too that a missed notice whose affidavit can still be filed now has the send in its footer, where the footer said the lien right was gone (PR #9215).
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
- **One choice is open for Grace.** Point 4 puts the claim figure faint in the head of the notice's
  column. v2.7430, the office's pick of 2026-11-15, took the figure out of the head. The choice was
  put to her through the lead session on 2026-11-19, and she had not answered when the PR merged. It
  is built with the head as the name alone, because that is what is on the live desk. The head is one
  line to change if her answer is the figure.
- **The phone.** The grid no longer slides. Each month sits over its window, an earlier paper is a
  mark like A ✓, and the tick has a column of its own at the right edge.

## Seen on the live walk (2026-11-20)

v2.7989 went live with the Pages deploy of 2026-11-20 at 06:49 UTC. It was walked read-only the same
night on clicktooling.com, in headless Chrome, signed in as the dev, with every write refused at the
network layer.

- **Four notices**, one for each state this card names: several missed windows and an open month, a
  month dated from the bill on a notice that went by hand, an earlier paper with closed months that
  still offer Note it as missed, and a draft with open months and work not billed yet. Each was read
  at 1,440 px and at 375 px, in light and in dark.
- **All sixteen looks** drew the ledger, with no element past the card's right edge and nothing
  sliding sideways. On the phone the page was 375 px of 375, the card 324, and the tick a 44 by 44
  target at the right edge.
- **The doors.** Change ›, Correct the claim › and Set on the job › opened their editor or window on
  every notice tried. Bill it from here › opened Bill Customer on a job linked to a customer. On a job
  with no customer it answered *Link this job to a customer before billing.* Record it… opened the
  already-mailed step at a desk, and on a phone once the footer was unfolded.
- **A tick** on the draft, made in the walk's own browser, moved the line under the figure from *This
  notice names Sep · 1 month* to *Sep, Oct · 2 months*. The section's head and the strip followed. The
  three saves the desk then tried were refused, so nothing changed on the job.

### Two gaps in Record it…, older than this card

Both live in the footers, not in the months card, and both were there before v2.7989.

1. **On a notice in Sent, or in Missed with no month still due, Record it… does nothing.** The press
   sets `byHandOpen`, and only the draft, awaiting, ready, printed and held footers draw the step
   (`byHandPane` in `LienDesk.tsx`). The sent footer and the missed line never draw it. Either the
   months card leaves the press out there, or those two footers draw the step too.
2. **On a phone with the footer folded, Record it… shows nothing until the footer is unfolded.** The
   step draws in the footer's place. Unfolding the footer when `byHandOpen` turns on would show it.

**Built 2026-11-20 as v2.8026.** Grace picked the second answer to gap 1: the sent footer and the
missed line draw the step too. The fix also covers a third face the walk's photos showed: on a
computer the step opened in the footer, below the paper's pages, so the press looked dead from the
months card. Opening the step now unfolds a phone's footer and takes a computer's pane to its last
section. The fragment is `docs/recent-features/v2.8026.md`.

**And v2.8027, on Grace's yes of 2026-11-20.** The live walk of v2.8026 showed the step's Apply had
no month to tick on a missed notice, since the step was handed the notice's own months, empty there.
A missed notice with no month still due now offers its closed months to tick, so a paper already on
record can stand for one. The step's checks and its reason still rule. The fragment is
`docs/recent-features/v2.8027.md`.

## Audited 2026-11-20

The owner asked for this card's work to be audited by a session on Fable 5.2. The findings, the method and five sheets of
screenshots are in the lead session's shared notes (`review-361.md` and the `review-361` folder). The build itself (#8990)
carries the Fable 5.2 trailer. The walk note and the two fixes of v2.8026 and v2.8027 are Opus 5.5.

**What held.** The total that left with the `tfoot` drew the same value the claim line draws, so no total, amount or count
is missing or different, and on eight live notices the bills' Owed added up to the claim to the dollar. Every deadline is
the kernel's. Record it… opened its step on every pile, at a desk and on a phone. Nothing slides at 390, 375 or 320 px.

**Three faults, fixed the same day.**

- **v2.8063 (#9076).** A closed month a paper named in time read *named after the window — information*. It reads *named
  in time* now, and keeps the old words only when every paper that names it went after its deadline. The words were older
  than this card. The rebuild carried them over.
- **v2.8064 (#9077).** The card asked for a tick nobody could make. Every Sent notice drew a *This notice* column of dead
  ticks, because the desk handed the grid no item there, and the lead line said *Tick a month to put it on this notice.*
  on Ready and Printed notices too. A Sent notice has no such column now, and the lead asks only where a row can be ticked.
  The fragment of v2.7989 says a notice that went has no column to tick. On the live desk it had one until this.
- **v2.8074 (#9075).** On a phone the *noted by* line of a closed month ran into the tick's column, and under the tick
  itself at 320 px with a long name. It wraps inside its own column.

**Five questions, put to the owner with pictures, and his answers.**

1. *On a missed notice, how should Record it… open?* **Nothing picked, nothing ticked.** v2.8027 handed the step the closed
   months, and the step ticked every month it was handed and picked the paper when the property had one, so a typed
   reason and one press recorded them all. The record reads such a month as noticed whatever the paper's date, and the
   affidavit reads the same rows. PR #9134.
2. *With two or more earlier papers, where should the tick column go?* **Pinned to the right edge.** The grid slid inside
   its frame and the column past the edge was this notice's. Seen on made-up months. No live notice has more than one
   earlier paper yet. PR #9130.
3. *On a notice that went, what should Record it… do?* **Go straight to the by-hand record.** The step opened on the
   notice's own paper with no month to tick and a dead Apply. PR #9134.
4. *On a slow read the step opened half under the window. Fix it?* **Yes.** The watch on the footer's growth stopped after
   4 s. The step now says when its read has ended and the pane lands on it again. PR #9134.
5. *Which presses on a phone should grow to thumb size?* **Every press on the card.** Each is 44 px tall to the touch. A
   press of words keeps its line, so the card is 26 px taller and no more. PR #9133.

**Live, 2026-11-21.** All five answers and the three fixes were walked on clicktooling.com, read-only, on six notices at
1,440, 1,068 and 390 px. A missed notice opens Record it… with no paper picked and no month ticked. A sent notice opens it
on the by-hand record. Apply stays inside the window. Every press on a phone is 44 px or more. The pinned column is in
place, but no live notice has two earlier papers yet, so it was seen sliding only on made-up months, and the phone's
noted line only on made-up names. The same walk found one more dead tick column. A missed notice with nothing due drew
*This notice* over empty locked boxes, and v2.8125 (#9148) draws that column only where a month can be ticked or one is
ticked already.

**Still open.** The figure in the head of the notice's column is Grace's choice, as above. The claim drops cents and its
lines keep them, as before this card. The empty card names no next press. The audit read the affidavit's side of
question 1 in the code and did not walk it.

**The walk's two older oddities, run down 2026-11-21.** Both were plain faults, older than this card, and each has its
own PR.

1. *On a sent notice the strip read* No month picked › *and the months head* no months. Both read the months a draft
   names. A notice that went is no draft, so the list was empty on every sent notice. Both now read the months the
   notice named, off the sent record, like *Jul + Aug ›*. A sent record that keeps no month reads *no month named*,
   which asks for nothing. None of the seventeen sent records on the desk is like that. PR #9211.
2. *A missed notice in the late window (v2.4708) contradicted itself.* Confirmed on made-up rows: one work month, May,
   its window closed Aug 15 with nothing sent or noted, the affidavit not filed and its last day Sep 15, read on Sep 14.
   The months card said *a late notice can still go · the affidavit by Sep 15*. The footer under it said *the lien right
   on that work is gone*, under *Window closed · Nothing to sign*, with no send. The closed month's stop on the timeline
   said gone too. v2.4708's rule says the card is right: the lien is gone only once the affidavit's window has closed
   too. So the footer there is now the draft's, with the send, and the stop says a late notice can still go. Past the
   affidavit's day everything reads gone, as before. No live notice is in the late window, so this was seen in tests
   only. PR #9215.

## How to verify

Open `/lien-desk?tab=notices` and pick three notices: one with several missed windows and an open
month, one whose month is dated from the bill, and one with an earlier paper A and a closed month
that still offers Note it as missed. Look in dark and light, at a desk and at 375 wide. Tick an open
month on a draft and the line under the claim's figure follows. Press each door and its window
opens. Nothing is saved by looking.
