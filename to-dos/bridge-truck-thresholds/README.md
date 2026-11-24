---
name: "Truck thresholds on the Bridge"
number: 442
group: ready
status: asked 2026-11-24 · the owner saw the mock-up and wants to use it · nothing is built
summary: >
  The owner wants to grow from the trucks that go out now to ten a week. A truck is a set number of
  people, and it needs a set amount of work sold every week to stay busy. So the plan is a ladder: each
  truck added is one more step of work sold a week. The Bridge already reads the work sold a week and
  the people in the field. This card puts the ladder on the Bridge without adding to the first screen:
  one line on the Talent card, a move in What to do now only when a step holds, and the whole ladder
  behind a press on the Talent card.
next: Build it as a spike on the Bridge with `/design-spike`, on live data, so the owner can walk how it sits with the rest of the page. Nothing ships until that walk.
size: M as a train of three (S · M · S)
blocker: The owner's walk of the spike.
opinion: build — the two figures it needs are already on the page, so it is one small kernel and three places to draw it.
---

# Truck thresholds on the Bridge (#442)

The repo is public. Every figure in this card and in `mockup.html` is made up. The owner's real rule is
typed into the app, never into the repo.

## The ask

Asked by the owner on 2026-11-24, in a session that read the job ledger to answer a growth question. The
words are paraphrased here.

- The owner wants ten trucks going out on jobs every week and has about two now.
- The session worked out a ladder. Each truck needs the same amount of work landed every week. So four
  trucks need four times that amount, five need five times, and so on up to ten.
- The owner asked for that ladder on the Bridge. A dev should see the thresholds and what each one
  allows in hiring.
- The owner said the Bridge is kept simple on purpose. The page should still signal when a threshold
  is about to be reached.
- The owner picked two people to a truck.
- The owner saw the mock-up and said to use it.

## The rule

The ladder is one rule, so the page stores the rule and never a table.

- A truck is a number of people. The owner picked two.
- A truck needs an amount of work sold a week. The mock-up uses $10k as a made-up figure.
- A step of the ladder is a truck count times that amount.
- The people a step needs is the truck count times the people to a truck.

The made-up ladder the mock-up draws:

| Trucks | Work sold a week | Field people |
|---|---|---|
| 4 | $40k | 8 |
| 5 | $50k | 10 |
| 6 | $60k | 12 |
| 8 | $80k | 16 |
| 10 | $100k | 20 |

## The decision

Three places, picked so the first screen does not change in a usual week. `mockup.html` draws all three.

1. **One line on the Talent card, every week.** The card sits behind **The flow** and already says how
   many are in the field. It gains one sentence: how many trucks the work sold fills, the next truck's
   threshold, and how far away it is.
2. **A move in What to do now, only when a step holds.** When the work sold has stayed over the next
   step, the first screen gains a move such as *Hire for truck 5*, with the figure behind it. In every
   other week the first screen shows nothing new.
3. **The ladder behind a press on the Talent card.** The steps, where the company is now, the next
   step, and the people each step needs. The two inputs of the rule are changed in place there.

The same line signals the other way. When the work sold fills fewer trucks than the company runs, the
line says so. That points at Market and Sales, not at hiring.

### What was turned down

- **The table on the first screen.** It adds five rows the owner reads once. The line and the move
  say the one step that matters this week.
- **A live rate for what a truck needs.** The session measured it from revenue per field hour. A live
  figure would move every threshold week to week. A typed setting holds still, and the owner re-sets
  it when prices change.
- **A new clock for "has it held".** The Bridge reads the last 8 weeks. A sold figure over a step has
  already held for 8 weeks. No second window.

## Where it plugs in

What exists:

- **Work sold a week** is `soldPerWeekUsd` from `src/lib/bridge/buildPace.ts`, the contract on jobs
  created over the window. It reaches the Sales stage through `SalesStageInput` in
  `src/lib/bridge/stageFlow.ts`.
- **People in the field** is `fieldPeople` in `ResourcesInput`, `src/lib/bridge/resources.ts`. The
  Talent reading there writes the gauge and the line the card shows.
- **The Talent card** is drawn by `src/components/bridge/BridgeResources.tsx`. A press opens its desk
  through `src/lib/bridge/linkDesk.ts` and `src/components/bridge/BridgeLinkDesk.tsx`.
- **What to do now** is `src/lib/bridge/weekCall.ts` with its words in `pulseWords.ts`, drawn by
  `src/components/bridge/BridgeWeek.tsx`.
- **Bridge settings** are rows of `app_settings` read in `src/lib/bridge/loadBridgeData.ts`, such as
  `bridge_cash_floor_usd_v1`.
- **Jobs with no price** are already counted as `unpricedJobs` in `ResourcesInput`.

What is new:

- **A pure kernel**, `src/lib/bridge/truckLadder.ts`, with unit tests. In: work sold a week, people in
  the field, people to a truck, work a truck needs a week, jobs with no price. Out: trucks the work
  fills, trucks the company runs, the next step, dollars to go, a state (short, level, close, ready),
  the ladder's rows, and the Talent sentence with each value marked by `val`.
- **Two settings**, the people to a truck and the work a truck needs a week. They sit beside the cash
  floor in `app_settings`. The code's default is a round placeholder, never the owner's real figure.
- **The ladder panel** in the Talent desk, drawn with `ValueLines`, `ChangeableValue` for the two
  inputs, `WorkedOutValue` for the rest, and `Money` for the amounts.
- **One move** in the first screen's card, shown only in the ready state.

## The plan

The next action is a spike, not a PR.

1. **Spike.** Start a worktree session with `/design-spike`. Build the kernel and all three places on
   the real Bridge, reading live data and writing nothing. Commit nothing and claim nothing.
2. **The owner's walk.** The owner opens `/bridge` on the spike and looks at how the three places sit
   with the rest of the page, on a desk and on a phone. The open questions below are answered there.
3. **The train, after the walk.** Each PR claims its own version and ships its notes and the guide.
   - PR 1 (S): the kernel and the line on the Talent card.
   - PR 2 (M): the ladder behind the press, with the two settings changed in place.
   - PR 3 (S): the move in What to do now.

The guide to amend is `src/content/help/the-bridge.md`, in **The three resources**.

## Open questions for the walk

1. **Trucks the company runs.** The app keeps no record of which trucks go out. The spike reads it as
   people in the field over people to a truck. The owner may want a typed count.
2. **The hold.** The spike uses the page's 8 weeks. The owner may want a shorter hold.
3. **Close.** How near the next step the line should turn amber. The spike uses within one tenth.
4. **Jobs with no price.** They count as zero in work sold. The spike marks the line with ≈ while any
   are open, as the page does for hours waiting on approval.
5. **The goal.** Whether ten trucks is a third setting or the ladder runs open.
6. **The Monday email.** Whether the line rides in it. The spike leaves the email alone.

## How to verify

- **Kernel tests** cover the four states: work short for the trucks run, level, close to the next
  step, and ready. They also cover no price on a job, nobody in the field, and a zero setting.
- **Render smokes** cover the Talent card with the line, the ladder panel, and the move showing only
  when ready.
- **The spike's walk** is read only: sign in as a dev, open `/bridge?door=flow`, read the Talent
  card, press it, and check the ladder against the Sales card's sold figure.
