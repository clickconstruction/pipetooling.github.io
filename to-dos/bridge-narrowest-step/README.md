---
name: "The Bridge lights the narrowest step"
number: 321
group: ready
status: drawn 2026-11-12 after a review of the Bridge once Market read on the won rates (#318) · nothing is built · 2026-11-25 (UTC): the meaning answered in the managing session, the scaling function is the narrowest step, the one that moves the fewest dollars a week · the rule itself answered later the same day: the Bridge lights the narrowest step, so PR 2 and PR 3 are no longer held · PR 1 built 2026-11-26 as v2.8622, each row's direction on the pipe, the red unmoved · PR 2 built 2026-11-26 as v2.8628, the page lights the narrowest step, held unarmed until its `bridge-weekly-sheet` redeploy has a yes
mockup: to-dos/bridge-narrowest-step/mockup.html
summary: >
  The Bridge lights the step with the most weeks of work waiting. With all five steps on one scale, that rule can
  light the one step that is ahead: a big backlog of sold work in front of a field that builds faster than Sales
  sells. The steps that hold the company back are the one that moves the fewest dollars a week, and the one whose
  pile grows. The drawing puts today's reading beside one that lights the narrowest step and says on each row
  whether its pile grows or shrinks. It is a question for the owner, since it changes the page's rule.
next: PR 1 (S), each row's direction on the pipe, which changes no rule. Then PR 2 (M), the rule the page lights by, and PR 3 (S), on the answer of 2026-11-25: the page lights the narrowest step.
size: M as three parts (S · M · S); the row directions alone are S
blocker: Nothing. The rule was answered on 2026-11-25 in so many words, so all three PRs can be built, in order.
opinion: build the row directions first; they add no new rule and let him see both readings on his own numbers
---

# The Bridge lights the narrowest step (#321)

## The ask

On 2026-11-11, while the Market and Sales work (#318) was being built, the request came to look again once it was
live: is this the best we can do, is the purpose met, does the reader get something he can act on, and can he dig in
to find the limiting factors of his company. The owner's own words for that purpose, the same day:

> "the goal of my recent changes were to get the Bridge more useful so I can narrow in on the scaling function as it
> is the limiting factor"

On 2026-11-25 (UTC) the managing session asked him: by *the scaling function*, did you mean the narrowest step?
The answer, quoted from that session's record of the user's answers: *Yes, the narrowest step, the one that moves the fewest dollars a week.*

That answer said what the words mean and not what the page should do, so the rule was asked in so many words later the same day.
Asked *Should the Bridge light the narrowest step in place of the most weeks waiting?*, the answer was "Yes, the narrowest step", quoted from that session's record of the user's answers.
What it frees: PR 2 and PR 3, after PR 1. What it leaves open: nothing on this card waits on a person.

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

Half made. It is the owner's, because it changes the rule the page opens on.
His answer of 2026-11-25 settles what *the scaling function* means: the narrowest step.
He was asked what he meant, and was not asked whether the page should change its rule.
By this card's own reading, below, that meaning makes the suggestion the page's rule, so the question has been put to the managing session and is not decided here.

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

PR 1 can start: the meaning is answered, and it changes no rule.
PR 2 and PR 3 waited on the word on the rule itself. It came on 2026-11-25, "Yes, the narrowest step", so both follow PR 1.

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

PR 1 is built as v2.8622 (2026-11-26): each row of the pipe says which way its work is heading.
PR 2 is built as v2.8628 (2026-11-26): the page lights the narrowest step, Market and Sales among the candidates, the held call, the close second and the thin-reading guard kept in pace terms, and every surface that named the slowest step or the weakest link says the narrowest step.
It changes `stageFlow.ts`, `weekCall.ts`, `flowStrip.ts` and `dial.ts`, which are copied to the edge functions and read by `bridge-weekly-sheet`, so it carries the regenerated copy and owes that function one redeploy after its merge, as v2.7230 did; until then the Monday email lights the old step.
PR 3 follows: the tile's two lines, the call on the lit step's moves, the guide's rule section, and this card's close-out.
