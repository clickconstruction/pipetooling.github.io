---
name: "The Bridge lights the narrowest step"
number: 321
group: gated
status: drawn 2026-11-12 after a review of the Bridge once Market read on the won rates (#318) · nothing is built · waits on the owner's answer to what the scaling function is
mockup: to-dos/bridge-narrowest-step/mockup.html
summary: >
  The Bridge lights the step with the most weeks of work waiting. With all five steps on one scale, that rule can
  light the one step that is ahead: a big backlog of sold work in front of a field that builds faster than Sales
  sells. The steps that hold the company back are the one that moves the fewest dollars a week, and the one whose
  pile grows. The drawing puts today's reading beside one that lights the narrowest step and says on each row
  whether its pile grows or shrinks. It is a question for the owner, since it changes the page's rule.
next: show the owner the drawing and ask what he means by the scaling function; build nothing before his answer
size: M as three parts (S · M · S); the row directions alone are S
blocker: The owner's answer. It changes which step the page lights.
opinion: build the row directions first; they add no new rule and let him see both readings on his own numbers
---

# The Bridge lights the narrowest step (#321)

## The ask

On 2026-11-11, while the Market and Sales work (#318) was being built, the request came to look again once it was
live: is this the best we can do, is the purpose met, does the reader get something he can act on, and can he dig in
to find the limiting factors of his company. The owner's own words for that purpose, the same day:

> "the goal of my recent changes were to get the Bridge more useful so I can narrow in on the scaling function as it
> is the limiting factor"

He has not said what *the scaling function* is.

## What the review found

Read on the page with all of #318 in place, as a dev on the live data. No figure from that day is on this card.

- **The page lit Build.** Its rule lights the step with the most weeks of work waiting.
- **Build's own card said it was ahead.** Sales sold less a week than the field built. So the pile in front of Build
  was shrinking. A backlog of sold work is not a jam.
- **Collect's card said the opposite.** The office billed more a week than customers paid. That pile grew every
  week, and cash was under the floor.
- **Market and Sales both read under the field's pace**, and neither can be lit: they hold no pile, so the weeks
  rule skips them.
- **The first screen said three things.** The tile named Build, the call was about cash, and the moves were
  Collect's.

So the reader had to subtract one row from another to see what holds the company back. Before #318 this could not
be seen at all: Market read every dollar that came in and was far the widest step. Now the five are on one scale,
and the narrowest one means something.

## The decision

Not made. It is the owner's, because it changes the rule the page opens on.

- **Now**: light the step with the most weeks of work waiting.
- **Suggested**: light the step that moves the fewest dollars a week. On each row, say whether its pile grows or
  shrinks, or for Market and Sales how far short of the field it is. Name two things on the tile: what growth waits
  on, and what cash waits on.
- **The smallest useful step**: add the row directions and leave the red where it is. No rule changes, and he can
  watch both readings on his own numbers.

The reading behind the suggestion: a company moves only as many dollars a week as its narrowest step. To grow, widen
that step. Widening any other only makes a pile. If that is what *the scaling function* means, the suggestion is the
page saying it. If it means something else, ask before building.

## The mock-up

`mockup.html` beside this card: one spot of the first screen, the step tile and the pipe on a phone, *Now* beside
*My suggestion*, with made-up figures. Under it: why the two rules disagree, what could be wrong with the
suggestion, and what it would take.

## Where it plugs in

Nothing is built. What exists:

| What | Where |
|---|---|
| The rule that lights a step | `src/lib/bridge/stageFlow.ts` (`buildStageFlow`: the most weeks to clear, a held call, the close second, the thin-reading guard). Copied to the edge functions. |
| Each step's pace | `src/lib/bridge/dial.ts` (`todayPace`). Market's is what the asks are worth since #318. |
| What comes in and what goes out, for Build, Bill and Collect | already on each card: `PileStageInput.inPerWeekUsd` and `outPerWeekUsd` |
| The pipe's rows | `src/lib/bridge/flowStripDown.ts` (`stripDownLines`), `BridgeFlowStripDown.tsx` |
| The tile and the call | `src/lib/bridge/weekCall.ts` (the step tile, `proposedMoves`). Copied to the edge functions. |
| The weekly email | `bridge-weekly-sheet` reads the same kernels, so it follows the rule |

## The plan

Only after the owner answers.

| PR | What | Size |
|---|---|---|
| 1 | **Each row's direction.** A line under each step on the pipe: the pile grows or shrinks by so many dollars a week, or the step is so far short of the field. Pure, from numbers the cards hold. The red stays where it is. | S |
| 2 | **The rule.** Light the narrowest step. Keep the held call, the close second and the thin-reading guard. Regenerate the edge copy and redeploy what `check:edge-drift` names. | M |
| 3 | **The tile, the call and the guide.** Two lines on the tile. The call proposes the lit step's moves. The guide's rule section in plain words. | S |

## How to verify

- The kernels: a test for each state, with made-up paces. A step ahead of what feeds it, a step falling behind, two
  steps close, a step that does not read, a week cash leads.
- The page: `npm run dev`, then `/dev-login?as=1&to=/bridge`, read only. Behind **The flow**, each card's two pace
  lines should agree with the direction on the pipe's row.
- The email: dry-run `bridge-weekly-sheet` before any redeploy and read its five steps.

## Gotchas

- **A pace is what happened, not what a step could do.** A step that is starved reads narrow too. That is why the
  direction of the pile is part of the reading and not a decoration.
- **The repo is public.** Made-up figures only, here and in tests.
- **The first screen is already over its word budget on a phone** (#318, PR 1). A line on each row adds to it.
  Market's two part lines could sit behind the press on a phone to pay for it.

## Where it stands

Drawn, not built. The next move is a conversation with the owner, with the drawing open.
