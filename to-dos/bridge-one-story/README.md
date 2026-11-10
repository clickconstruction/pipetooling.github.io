---
name: "The Bridge under one story"
number: 303
group: ready
status: asked 2026-11-10 · the October design recovered from history, the page walked at desk and phone width, its loop read through the dev seat · three stories and a pick drawn as thirteen frames the same day · the owner chose the pick the same day and said build it · PR 1, the first screen above the page as it is, shipped as v2.6832 · the owner said the bank is the whole bank and asked for every account, so v2.6838 lists them with a switch on each and turns the cash rule on
mockup: to-dos/bridge-one-story/mockup.html
summary: >
  The Bridge has been drawn three times, each on top of the last: a chart table in September,
  field contribution per week on Oct 10, the weakest link on Oct 11. It is 13.7 screens on a
  phone and tells three stories at one volume. The press the October design called the product,
  the week's call, sits five phone screens down and has never been pressed. The weekly email has
  never been sent. This card draws three stories the page could tell instead: one decision a
  week, cash first, and the flow as one picture. The pick is the first, with the picture as one
  strip and one rule from the second: when cash goes under the floor, cash leads. Nothing built
  is deleted. It moves behind three doors.
next: PR 2, the doors, with the six cuts. The owner's other five calls can be answered alongside.
size: L as a train of five (M · M · S · M · S); left: PRs 2 to 5 (M · S · M · S)
blocker: None for PR 2.
opinion: build the pick, PR 1 first, and give it four Mondays. If the call is still unpressed on the first screen with the moves reaching people, the ritual is the problem and the page falls back to three numbers and one list.
---

# The Bridge under one story (#303)

## The ask

Asked 2026-11-10: *"I feel like the bridge page could be better. How could we make it better? I
think we need to look at it holistically, even if it means we refresh it under a new narrative."*

Design only. Nothing in the app changed and nothing was written to prod.

## What was drawn before

Three drawings, each layered on the last.

- **September, the chart table**: three cards, net position, the truth check, Vectors, the cash
  forecast, bills and receipts.
- **Oct 10, the redraw** (`docs/recent-features/v2.5216.md` to `v2.5224.md`): the page opens on
  the number we maximize, field contribution per week, with two lights. Cash is read from the
  bank. *This week* and *Fix the reading* move up. The people tables fold. The Monday sheet.
- **Oct 11, the weakest link** (`v2.5232.md` to `v2.5243.md`): one rule, five stages with the
  link lit, a dial, three resources, a desk that records the week's call, Friday's answer, the
  usual fixes as presses, a breakdown behind every number. On Oct 26 a desk behind every stage
  card (#192, `to-dos/bridge-stage-desks/`, still open on two yes-or-no writes).

The October design lived on a canvas this account cannot open (artboard E, 77 versions). Its
card and a static render are in history: `git show 'd38ed492d^:to-dos/bridge-weakest-link/README.md'`
and `…/prototype.html`. What matters from it now:

- **He picked every piece and asked that nothing be excluded**: *"I want everything built to be
  added so I can begin making suggestions that don't exclude anything."* That instruction is why
  the page is long. This ask is the first that allows a cut.
- **He loved the eight bars**: *"I love the Last 8 pay weeks chart, let's keep that."*
- **He turned down**: the six buckets as a page of their own, a three stop walk as the opening,
  a one sentence lever under the slider, a seven row list of the other links' levers, and the
  four usual fixes under the dial.
- **Its own third pass said**: *"The calls are the product; everything else is a reading."* It
  also named Friday as the missing half of the loop, and two cash figures on one page as a
  defect.

## Today's page, measured

Walked 2026-11-10 in a local preview as the dev account, at 1440 × 900 and 375 × 812. The counts
measure the page, not the company.

| | Desk | Phone |
|---|---|---|
| Height | 5.2 screens | 13.7 screens |
| First screen | 584 words, 88 numbers | 163 words, 33 numbers, no stage |
| Whole page | 2,597 words, 414 numbers | the same |
| The press that records the call | 1,027 words and 124 numbers come first | 5 screens down, 34 px tall |

- **Three stories, one under the other.** The rule line says *find the slowest step*. The panel
  under it says *what we maximize*. The oldest third, at the bottom, is about cash and net
  position. Section 1 of the mock-up draws the scroll in bars, coloured by drawing.
- **The same thing, many times.** 27 figures are printed in two or more sections. Six sections
  ask for the hours to be approved, five for the percents, three for prices, three for the
  finished work to be billed.
- **Five lists of things to do**: the piles on you, the desk's moves, the usual fixes, *This
  week*, *Fix the reading*.
- **Four readings of "are we making money"**, with different signs on the same day: the week's
  contribution, the daily profit rate, net position's change and profit on paper. The Oct 10
  redraw said the daily rate reads approved hours only and shows a loss when hours wait. The card
  stayed.
- **The longest block is at the very bottom**: bills due and receipts expected, 2.1 phone screens.
- **The Monday sheet** says *one screen*. It is 3.1 screens on a phone, with 88 numbers.
- **Phone presses**: 42 of 61 are under 36 px tall.

## Is the page's own loop used?

Read 2026-11-10 through the dev seat.

- **`bridge_calls`: 0 rows.** The page itself reads *No call yet*. Card #190 found the same in
  late October. The call shipped on Oct 11. Five Mondays have passed.
- **The weekly email has never been sent.** `bridge_weekly_sheet_on_v1` is `false` and
  `bridge_weekly_sheet_last_run_v1` is empty. It shipped on Oct 26.
- **One account has opened the page**: a dev, on 23 days in 90, about 1,065 minutes in
  `user_app_activity_page_daily`. The long days are the days the page was being built (Sep 3,
  Sep 11, Oct 25 to 27, Oct 30, Nov 2, Nov 9), and a preview walk by a session signs in as that
  account, so some of those minutes are sessions like this one. That account was on the page on
  three of the five Mondays and recorded no call.
- **The page was dev only until v2.6763** (2026-11-08). The owner's role can open it and record a
  call since then. No visit by it is on record yet.

So the loop has never run. Three reasons are visible on the page: the press is buried, a call
asks for a name typed on every move, and a name typed there reaches no one.

## Three stories, drawn

`mockup.html` beside this card: made-up figures, the app's token names, a Light and Dark switch.
Each story is its first screen on a phone and at a desk, then what sits behind its doors.

### A · One decision a week (frames A1 to A4)

Three numbers say where we stand: earned last week, cash's low point against the floor, the
slowest step. One card names the step and proposes two or three moves, each with a person and a
door. One press makes it the week's call. On Friday the same card asks whether it moved.

- **Leaves the scroll**: everything else, behind three doors. *The flow* holds the five stages,
  their desks, the dial and the usual fixes as *Try a change*. *Money* holds cash, bills,
  receipts, net position with the truth check inside it, and what is owed. *People* holds
  Vectors, the day grid and crew hours. *Soft numbers* is one list in place of *Fix the reading*
  and the piles. The Monday sheet retires as a view, because the first screen is the sheet.
- **Reuses**: `buildStageFlow` for the step, `callForWeek`, `fridayAsks`, `buildScorecard`,
  `streakFor` and `moveDone` for the call and Friday, `LINK_DESK`'s move presets and
  `buildThisWeek` for the moves and their doors, `buildHeadline` for the bars, `cashLight` and
  `buildCashForecast` for the cash tile, `buildReadingGaps` for the soft numbers.
- **New**: one kernel that builds the first screen, and its component.
- **Costs**: M · M · S. No migration.
- **Its risk**: it makes the one thing nobody has used the whole page.

### B · Cash first (frames B1 to B3)

The page opens on the day cash goes under the floor. Under it are the few moves that change that
day, each one marked *enough*, *not alone* or *December*.

- **Leaves the scroll**: the weakest link, whole, to a door named for what it answers: is enough
  work coming after these eight weeks. Net position and People each get a door. The bills and
  receipts lists shrink to the next 14 days.
- **Reuses**: `buildCashForecast`, `receiptsConfidence`, `carryingDay`, `buildCashPanel`,
  `loadMercuryCash`, the Collect desk's what-if.
- **New**: a kernel that finds the day, and runs the forecast again with one move applied.
- **Costs**: M · M · S. No migration.
- **Its risk**: it stands on the bank's balance being the whole bank, and most of what the
  window expects is late money the page assumes will land. The loudest number would be the
  softest. It never looks past eight weeks. In a good month it has nothing to say.

### C · The flow as one picture (frames C1 to C3)

The five steps drawn as one line of pipe. A section is as wide as the dollars it moves in a week.
The narrowest is lit. Bars under it show the weeks of work that wait in front of each section. A
tap opens the section's desk.

- **Leaves the scroll**: the five cards become the picture. The dial becomes a drag on a
  section. Money sits at the bank end of the pipe. People sits behind the earned number.
- **Reuses**: `buildStageFlow`, `todayPace`, `applyDial`, the five desks.
- **New**: a geometry kernel and an SVG in two shapes, across at a desk and down on a phone.
- **Costs**: L · M · S. The costliest, and the easiest to get wrong.
- **Its risk**: a picture shows where and tells no one what to do. Two of its five sections,
  Market and Sales, have no pile to draw. On a phone it fills the first screen and the words
  beside it do the work.

## The pick (frames P1 to P3)

The owner, 2026-11-10, on the frames: *"this is the right way to look at it. Please help me build
it."* The pick is the direction.

**A is the story, with two borrowings.**

- **From C, one strip.** The pipe as a single line in place of five cards of about seventy words
  each. Where we stand should be seen, not read. As a strip it costs one line on a phone.
- **From B, one rule.** When the forecast goes under the floor inside the eight weeks, the cash
  tile leads, the first moves are cash moves, and the slowest step is the move after them (frame
  P2). The page's two constraints already say this. Nothing on it acts on them.
- **One thing none of the three had: the call reaches people.** Each move on a recorded call
  lands in its person's *Needs you*, with its door, and clears when the number moves. Today a
  name is a word in a box.

Why A: the page's trouble is that it has readings and no reader. A is the only story that asks a
person to do something and then asks whether it worked. B and C are better readings.

The pick's first phone screen (P1) holds 139 words and 22 numbers, with the step, two moves and
the press. Today's holds 163 and 33, with none of them. Its desk screen (P3) holds 256 words and
40 numbers against 584 and 88.

## The second look: is this the best we can do?

What could still be wrong with the pick.

1. **The call is what has gone unused, and the pick makes it the page.** The bet is that it went
   unused because it was buried, dev only, and reached no one. The test is four Mondays. If the
   call is still unpressed, the ritual is the problem, and the page falls back to three numbers
   and one list.
2. **"Earned last week" is new.** The page leads with this week so far, which is nearly empty on
   the Monday the call is made. The last full pay week is the fairer number. It changes a figure
   the owner chose, so it is his call.
3. **The October choices.** He turned down a three stop walk as the opening. The pick is one
   screen, not a walk. He moved the four usual fixes out from under the dial. Here the fixes and
   the dial leave the first page together.
4. **Two moves on a phone, three at a desk.** A fourth is a list again.
5. **A budget, held by a test.** The first screen's words come from one kernel. A unit test can
   hold a phone's first screen to 150 words and 24 numbers, the way `plainWords.ts` holds a guide.
6. **The cash rule needs the bank answer.** Until the owner says the bank read is the whole
   bank, the cash tile shows and does not lead.

### What I would cut even if nothing else changed

Each is small and stands alone.

1. **The Daily profit rate card.** It shows a loss beside a headline that shows a gain.
2. **Four of the five lists.** One list, each row saying what it moves.
3. **The truth check as its own panel.** It explains the net position line and belongs inside
   that line's *Break it down*.
4. **The bills and receipts lists on the page.** Show 14 days. Keep the rest behind the chart.
5. **The owner box on every move.** Fill it from who did that work, and let a tap change it.
6. **The Monday sheet as a second view.** A first screen that fits needs no sheet.

## The plan, for the pick

| PR | What | Touches | Size |
|---|---|---|---|
| 1 · shipped v2.6832 | **The first screen.** A kernel builds the three tiles, the proposed call with its moves, people and doors, the cash-leads rule and Friday's state. Drawn above the page as it is, so nothing moves yet. A budget test and the plain words test hold its sentences. | `src/lib/bridge/weekCall.ts` + test, `BridgeWeek.tsx` + render smoke, `Bridge.tsx` | M |
| 2 | **The doors.** The scroll becomes *The flow*, *Money* and *People*, with *Soft numbers* as one list. The six cuts above. | `Bridge.tsx`, `softNumbers.ts` + test, the guide *read the Bridge* | M |
| 3 | **The strip of pipe.** A geometry kernel and one SVG, with words for a screen reader. A tap opens the desk already built. | `flowStrip.ts` + test, `BridgeFlowStrip.tsx` | S |
| 4 | **The call reaches people.** A move carries its person's id. Each person reads their own moves in *Needs you*. One migration: a function that hands a caller only their own moves, since office roles cannot read `bridge_calls`. | migration + its doc page, `calls.ts`, the Needs you card | M |
| 5 | **The Monday email is the first screen.** `?view=monday` retires. The mail carries the screen and a link to make the call. The function is redeployed. | `mondaySheet.ts`, `bridge-weekly-sheet`, `docs/EDGE_FUNCTIONS.md` | S |

PR 1 ships by itself and is the cheapest way to learn whether the bet is right.

## How to verify

- **The frames**: add a gitignored entry to `.claude/launch.json` that runs
  `python3 -m http.server 8763 --directory to-dos/bridge-one-story`, start it, open
  `http://localhost:8763/mockup.html`. Add `?v=2` after an edit, since the pane caches the page.
- **The page**: `http://localhost:5173/dev-login?as=1&to=/bridge` on the dev server. It reads
  prod. Press nothing that records. A walk adds to the page minutes as the dev account.
- **The counts**: numbers are matched as `$?\d[\d,.]*(k|M|h|%|d)?` over the page's text. The
  first screen is every text node whose box crosses the top 900 px at a desk, or 812 on a phone.
- **The loop**: `bridge_calls` and `user_app_activity_page_daily` (page `bridge`) through the dev
  seat's `read_rows`, and the two `bridge_weekly_sheet_*` rows of `app_settings`.

## Found in passing, not fixed

- The page's loading line still ends *Dev only* (`Bridge.tsx`). The owner opens it since v2.6763.
- The Monday sheet's header says *one screen, three lights, five moves* and runs to 3.1 phone
  screens.
- The typed cash figure still in `app_settings` is dated 2026-09-03. It is only the fallback.

## The calls that are the owner's

1. **The story.** Answered 2026-11-10: the pick.
2. **Is the bank the page reads the whole bank?** Answered 2026-11-10: yes, and he wants each account's balance, since he sometimes counts *Accounts Payable* in cash and sometimes does not. Shipped as v2.6838.
3. **The first number.** Earned last week, the last full pay week. Or this week so far, as today.
4. **Who a move reaches.** Each named person gets the move in their *Needs you*. Or the call
   stays on the Bridge.
5. **The Monday email.** On, to the owner and the devs, carrying the first screen.
6. **The cuts.** The six above, with or without the rest.
7. **Who else opens it.** Owner and dev today. The call names office people who cannot see the page.

## Where it stands

Drawn 2026-11-10 and chosen the same day. PR 1 shipped as v2.6832 (`docs/recent-features/v2.6832.md`): the first screen sits above the page as it was, and the tile the frames call *Earned last week* reads *Made last week*, since the number is earned less wages. On a phone the record press is on the first screen and the three doors sit just under it until PR 2 takes the Monday sheet's row out of the header. v2.6838 (`docs/recent-features/v2.6838.md`) answered his call 2: the cash rule is on, and under the cash chart every bank account is listed by its Mercury name with a switch for whether it counts as cash on hand. The weekly email still counts the whole bank until PR 5, and the floor, the typed cash and the account choice save for a dev only, not yet for the owner's role. PR 2 is next. #192's two yes-or-no writes are untouched by this card: its desks
sit behind *The flow* in every story.
