---
name: "Quickfill Percent complete: a slider to set the % done"
number: 154
group: close
status: built 2026-10-23 as v2.5805 · left: the owner's look at it live
summary: >
  Each card on Quickfill's Percent complete station holds one number box, pre-filled with the
  number the facts suggest. Any other number is arithmetic and typing. The pick: the card's own
  stage bar becomes the slider. A blue knob rides the bar at the number about to be saved, one
  chip per stage end and one for the paid share sit under it as stops, the box stays for an
  exact number, and one line reads the move before Save writes it. Nothing new on the server.
next: The owner's look at it live on a real card, then delete the folder (the v2.5805 fragment links the mock-up).
size: S
blocker: none
ver: v2.5805
opinion: build B — the bar is the slider, the stage ends are its stops, the box stays; A draws a second bar, C cuts out the middle
---

# Quickfill Percent complete: a slider to set the % done (#154)

## The ask

From the owner's session of 2026-10-23, as the brief that opened this one: *Quickfill Percent
complete: a slider to set the % done. Come up with a mock up of how you think this could work
and then ask yourself is this the best we can do and then build it.*

The station itself came from the owner's words of the same morning (v2.5764): "make it very,
very easy for an assistant to get this information presented to them in QuickFill and be able
to update the percentage complete."

## Today

Each card draws the job, the kind chip, the Pipeline's stage bar with its dark tick, the
numbers line, the sentence, a *Suggested N%* line, a number box pre-filled with the
suggestion, **Save N%** and **Dismiss for one week**
([`QuickfillPercentCompleteSection.tsx`](../../src/components/quickfill/QuickfillPercentCompleteSection.tsx)).

The suggestion is a floor. *Rough ticked* says the job is at least 40% done. An assistant who
has the crew report in hand knows they are two days into Top Out, so the honest number is
between 40 and 75, and on today's card that is mental arithmetic (40 plus about half of 35)
and then typing. The two numbers an assistant jumps to most, the end of a stage and the paid
share, are both on the card already, as a tick and a figure, but neither is a press.

## The mock-up

[`mockup.html`](./mockup.html), served at `/to-dos/quickfill-percent-slider/mockup.html`. The
pages work: drag, press, type. Three made-up jobs: 1203 Ridgeway Builders lot 7 (Rough paid,
the job says 0%), 1188 Cedar Bend building C (Rough and Top Out paid, the job says 30%), 1177
Dana Whitfield's water heater (one line, paid in full, the job says 60%).

### A · a slider under the box

The Pipeline's Job activity panel has a *Set % complete* slider under its box, a plain 0 to 100
range with 0 · 25 · 50 · 75 · 100 under it. Copy it onto the card.

- Straightforward: yes, forty lines.
- Is this the best we can do: no. The card now draws two bars, one with the facts and one for
  the answer, and the eye walks between them. The 25 · 50 · 75 marks mean nothing on this job;
  its stages end at 40 and 75. On a phone two bars is one too many.

### B · the bar is the slider, the stages are its stops (the pick)

The dark tick stays where the job is today. A blue knob rides the same bar at the number you
are about to save: drag it, or tap anywhere on the bar. Under the bar, one chip per stage end
(*Rough ✓ 40%*, *Top Out 75%*, *Trim Set 100%*) and one for the paid share when it is not a
stage end (*Paid 57%*), pressed when the knob sits on it. The box stays for an exact number.
One line reads the move, *0% → 57% ▲ 57*, and the button says exactly what it will do: **Save
57%**, or a dead **Save** when the knob sits where the job already is.

- Straightforward: the bar is already on the card. The knob is one absolutely placed element
  and a pointer handler; the place on the bar for a percent is the Pipeline's own
  `tickLeftPct`, and the slider needs its inverse; the stops are a kernel function over the
  stage shares the card already reads.
- Is this the best we can do: see below.

### C · stops only

The chips of B without the knob: every real answer is a stage end or the paid share, the
thinking goes, so why drag.

- Straightforward: the most.
- Is this the best we can do: no. *Behind the stages* is the common case: job 1188 says 30%
  with Rough and Top Out ticked and the crew into Trim. The right number is 80 or so, and no
  chip says 80. A chip cannot show where on the job the number lands; the knob on the bar does,
  against the paid green and the stage names. C is B with its middle cut out.

## Side by side

| | Today | A | B | C |
|---|---|---|---|---|
| The suggested number | one press | one press | one press, the knob starts there | one press |
| A stage's end | type it | drag to it by eye | one chip | one chip |
| A number between stages | arithmetic, then type | drag, on a bar with no stages on it | drag on the stage bar, read the number | type it |
| Sees where the number lands | no | no, the two bars are apart | yes | no |
| Lines added to the card | 0 | 2 | 2 (the stops, the move line) | 1 |
| Keyboard | type | arrows on the range | arrows, Home, End on the knob; the box | the chips, the box |

## Is B the best we can do?

Four things it gets right, two it leaves out, one quirk it inherits.

1. **The facts and the answer are one picture.** The knob sits over the stage blocks and the
   paid green; the dark tick beside it is where the job stands today. The move is visible before
   it is written.
2. **The two numbers an assistant jumps to are one press each.** Every stage end and the paid
   share are chips, with the number on them.
3. **Nothing is written that the person has not read.** The move line and the Save button both
   name the number; a knob on today's number makes Save dead.
4. **Nothing new on the server.** The save is the same activity note and the same column as
   today; the dismissals are unchanged.
5. **Left out, on purpose:** a note box beside the slider (the move line is the note the save
   writes, as today); snapping the knob to a stage end as it passes (a knob that jumps mid-drag
   fights the hand). The snap is on release only: let go within two points of a stop and the knob
   lands on it; the chips reach any stop in one press.
6. **Inherited from the tick:** on a job with a paid Deposit stage the suggested number leaves
   the deposit out (a deposit is not work, v2.5764), so the knob at the suggestion sits a little
   short of the stage block's end, exactly where the Pipeline's own tick sits for that number
   today. Not changed here; it is the Pipeline's rule.
7. **Fixed on the way:** v2.5764 divided a stage's price by the bid, which differs from the
   bar's own share on a discounted bid or a job with a plain line beside its stages, and there
   the suggestion sat short of or past the stage's block. The build puts the ticked share and
   the stops on the bar's own segment share, the one the tick walks, so every stop and the
   suggestion sit exactly at a block's end. On the live cards checked the two agreed.

## Where it plugs in

- The card: [`QuickfillPercentCompleteSection.tsx`](../../src/components/quickfill/QuickfillPercentCompleteSection.tsx)
  (the box, Save, Dismiss, the done lines). The two-column card becomes one column with an
  action row: the stops, the move line, the box, Save, Dismiss.
- The bar: [`StagesStageBar.tsx`](../../src/components/jobs/StagesStageBar.tsx), unchanged; the
  slider is a layer over it in a new `QuickfillPercentBarSlider.tsx`.
- The place on the bar for a percent: `tickLeftPct` in
  [`jobMoneyBar.ts`](../../src/lib/jobs/jobMoneyBar.ts) walks the money shares and lands at the
  same fraction of the block the percent falls in. The slider needs the inverse (a fraction of
  the drawn bar → the percent), a new pure `pctFromTickLeft` beside it, tested as its inverse.
- The stops: a new `percentStops` in
  [`percentComplete.ts`](../../src/lib/quickfill/percentComplete.ts) over the stage bar's
  segments (Deposit left out, the same share the ticks use), the paid share folded in when it
  is not a stage end; stored on the card as `stops`. Each is a stub under the bar, and
  `snapPercentToStops` lands a released knob on one within two points.
- The app's other sliders (the Legal desk's settlement floor, the write-down panel) are inline
  native ranges, not a shared component; a native range maps its track linearly and cannot sit on
  the floored stage bar, so the knob is drawn by hand on the same box-and-slider pattern.
- The write: unchanged, [`percentCompleteWrite.ts`](../../src/lib/quickfill/percentCompleteWrite.ts).
- The words: the guide *fix a job's percent done in Quickfill* and the station's intro line.

## The plan

1. **PR 1, this folder** (docs only).
2. **PR 2, the build** (one version): `pctFromTickLeft` + tests; `percentStops` + tests; the
   slider component; the card's new action row; `index.css` for the knob's touch size and focus
   ring; the guide; the release note and fragment; the Glossary and architecture lines; this
   README to *built*.

## How to verify

Quickfill → Percent complete as the dev or an assistant. On a card: the knob starts on the
suggested number with its chip pressed; drag the knob to the middle of a stage and read the box;
press a chip and watch the knob move; type 57 and watch the knob and the chips; press Home on
the focused knob and watch Save go dead on *no change*. Save on a ZZ test job only and check the
row's % and the Job activity note. On the phone preset the action row wraps to two lines and the
knob grows to a thumb.

## Where it stands

Proposed and built 2026-10-23 as v2.5805 (PR 2), the pick taken as recommended. Checked live as the dev on real cards at desktop and phone widths; nothing saved. Left: the owner's look, then delete the folder.
