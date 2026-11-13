---
name: "Market and Sales on the won rates"
number: 318
group: close
status: asked and walked 2026-11-11 in a spike on the Bridge · the rules are the owner's, set that day in his words · PR 1 shipped as v2.6973, the pipe standing up with Market at what it is worth · PR 2 as v2.6975, the chart of wins by bid size on the Bid Board · PR 3 as v2.6977, the Market and Sales windows on the shared frame · PR 4 as v2.6979, one rule on the page · PR 5 as v2.6983, the weekly email on the Market amount · PR 6 as v2.6988, the guide and the docs · all six built, and every function redeployed 2026-11-12 · a visual pass at three widths as v2.6998 · checked 2026-11-13 against main and production: every commit is on main, the train's tests pass, every function is current, and nothing on the plan is left to build · the Monday email has never gone out and its switch is on · what is left is the owner's calls and his read of Monday's email · branch claude/318-bridge-won-rates-pr1-a42022 and the ones after it
mockup: to-dos/market-sales-won-rates/mockup.html
summary: >
  The Bridge read Market as every dollar asked in a week and judged it at one win share for everything. The owner set new rules in one sitting: estimates and bids each run through their own won
  rate by dollars, a bid counts only when it is marked, an unmarked bid ages into a loss, and each bid is read
  at the rate for bids its size. Market then reads as one amount on the same scale as the other four steps.
  The pipe, the Market and Sales windows and a chart on the Bid Board read this way since PRs 1 to 3
  (v2.6973, v2.6975, v2.6977). The page's own Market and Sales cards, the slowest-step reading, the weekly email
  and the guide followed with PRs 4 to 6 (v2.6979, v2.6983, v2.6988). This card holds every rule and what is left, which is the owner's calls.
next: the owner answers the seven calls still open at the top of Where it stands, a word each, and reads the email of Monday 2026-11-16; then the card is retired on his word
size: L as a train of six (M · S · M · M · M · S), all shipped; left: the owner's calls (XS)
blocker: None for the build. Monday's email matches the page only once #7948 and #7893 are merged and `bridge-weekly-sheet` is redeployed, and both belong to #334.
opinion: your call — nothing is left to build; retire it after Monday's email is read, because no real send has shown the Market amount yet.
---

# Market and Sales on the won rates (#318)

## The ask

All of this was said on 2026-11-11, on the Bridge spike, while the owner looked at the live page. His words:

- On Market's line *asked $X a week*: "I don't understand the word asked a week." Then: "I think the word we
  should use is bid."
- "I would like to upgrade our estimates system such that on the bridge we see our Estimates sold after the
  coefficient of WON by dollars. … And then we're going to do the bids next, but the bids we're gonna do a
  little differently".
- "Sometimes it takes someone more than fourteen days to decide on an estimate. I would say that we should
  count estimates that are not signed after ninety days as lost."
- "When we send a customer multiple estimates and they choose some of those estimates, we can assume ones that
  they did not choose are lost". Asked whether an estimate for another address stays out: "Yes, same address
  only".
- "All I care about is the bids won in dollars, the same way we care about the estimates won in dollars. And
  we should use that to calculate a coefficient that allows us to signal the correct market amount."
- Shown a first cut that called a bid lost at 180 days and won when a job was made from it: "It is lost until
  we mark it lost. And I don't think the bid should be counted as one until we marked IT WON". Read as: not
  lost until marked lost, not won until marked won.
- Asked whether the mark *started or complete* counts as won: "Yes, count it won".
- "there is a 50% chance we lost the bid if we have not heard back in 90 days, and there is a 95% chance we
  lost the bid if we have not heard back within a hundred 80 days".
- On very large and very small bids: "I don't think we should count these. I think we should only count bids
  within Two standard deviations." Shown that the won rate falls with the size of the bid, he chose a rate for
  each size over a cut: "Okay, I like this. I also need you to exclude all the grayfox bids."
- On the chart of wins by size: "I really like your chart of what bids we are winning based on size. I would
  like to add that to the bid board somehow." Asked whether the board's Health section is the place: "Yes, keep
  it there".
- On the five step windows, drawn before and after: "Like all of your recommendations, build it all." On the
  three leftovers in Market and Sales: "Yes, tidy them".
- Then: "I want a different session on a different computer to build the rest of this. Can we save the market
  and sales to a punch list card with all the details saved so another session can build it."

His aim behind it: "the goal of my recent changes were to get the Bridge more useful so I can narrow in on the
scaling function as it is the limiting factor". He has not defined *the scaling function*. Ask him.

## The rules, as decided

### Estimates

- **Won**: the customer approved it.
- **Lost**: the customer declined it; or the customer did not choose it; or 90 days passed with no answer.
- **Not chosen**: an estimate with no answer whose customer approved another estimate *after this one was
  sent*, for the same address. When either estimate has no address they count as the same job.
- **Still out**: an estimate with no answer that is none of those. It is in neither count.
- Two edges are the builder's reading and were put to him. He confirmed the address edge. He did not object to
  the other: an estimate sent after the customer's last approval is a new ask and stays out.
- **The won rate**: won dollars ÷ (won dollars + lost dollars).
- **Sold a week**: the dollars of estimates sent in the page's eight weeks, a week, times the won rate.
- Change orders and bid proposals share the table and are left out.

### Bids

- **Won**: the bid is marked won, or marked started or complete. Nothing else. A job made from a bid decides
  nothing.
- **Lost**: the bid is marked lost.
- **No mark**: part lost by age. Nothing under 90 days from the day it was sent, half from 90 days, 95% from
  180 days. Never part won.
- **A rate for each size**: under $10k, $10k to $50k, $50k to $500k, over $500k. In each size, won dollars ÷
  (won + lost dollars, the aged part included). A size with nothing won or lost reads at the rate of all sizes
  together. This is what replaced his two-standard-deviations idea: a giant bid is read at the rate for giant
  bids, and nothing is thrown away.
- **Won a week**: each size's dollars sent in the eight weeks, a week, times that size's rate, added up.
- A bid's dollars are the agreed value, else the bid's value. A won bid with neither takes its job's revenue.
- A bid never sent is in no count. A ZZ test bid is in no count. A bid on anything the Bridge leaves out is in
  no count.

### Market

- **Market is worth** what the bids win a week plus what the estimates sell a week. That one amount is on the
  same scale as Sales, Build, Bill and Collect.

### What was tried and dropped, so nobody tries it again

- One win share for bids and estimates together, over the eight weeks: it read very low and made Market look
  far bigger than it was worth.
- An estimate counted as not won after 14 days: the owner said people take longer.
- A bid counted as lost at 180 days: the owner said only a mark decides, then gave the two chances above.
- A bid counted as won when a job was made from it: the owner said only a mark.
- Leaving out bids beyond two standard deviations: the spread is wider than the average, so the rule cannot
  reach the small end, and the large bids inflate the very spread meant to catch them.

## The mock-up

`mockup.html` beside this card: the five step windows before and after, with made-up figures. Sections 1 and 2
are Market and Sales. The pipe and the Bid Board chart were prototyped straight on the page and have no
drawing.

## Where it plugs in

Everything below under *Built* is on the branch `spike/bridge-scaling`, one commit on top of `main`. Its
hand-over is `to-dos/bridge-one-story/SPIKE_HANDOFF.md` on that branch, which also covers the spike's other
candidates.

### Built on the spike branch

| What | Files |
|---|---|
| Estimates' won rate | `src/lib/bridge/estimateWins.ts` + test (12), `loadEstimateWins.ts` |
| Bids' won rate, the rate by size, the Market amount | `src/lib/bridge/bidWins.ts` + test (15), `loadBidWins.ts` |
| The Market row on the standing pipe, sized from the amount | `flowStripDown.ts` (`withMarketWorth`), `BridgeFlowStripDown.tsx`, wiring in `Bridge.tsx` |
| The chart on the Bid Board | `src/components/bids/BidBoardWonBySizeSection.tsx`, placed in `BidBoardEstimatingHealthSection.tsx` under The pulse. It reads the board's own bids, so it follows the trade. |
| The shared window frame | `src/components/bridge/BridgeStepWindow.tsx` |
| The Market window | `BridgeMarketDesk.tsx`, `src/lib/bridge/market/marketStepWindow.ts` + test, and `marketDesk.ts` moved to the mark-only rule and plain words |
| The Sales window | `BridgeSalesDesk.tsx`, `src/lib/bridge/sales/salesWorth.ts` and `salesWeek.ts` + tests, and `salesDesk.ts` moved to the mark-only rule and plain words |

On that branch every Bridge and Bid Board test passes, the typecheck is clean, and all five windows were walked
on the dev server at desk and phone width with no page error. No press that records was pressed.

### Not built: the rest

Items 1 to 4 shipped with PR 4 (v2.6979), item 5 with PR 5 (v2.6983), and items 6 and 7 with PR 6 (v2.6988). They are kept here for the record of what was asked.

1. **The Bridge's own Market reading.** `stageFlow.ts` still reads Market as dollars asked a week and judges it
   through `marketWinShare`, one share for bids and estimates over the eight weeks. That decides the Market
   card's two lines behind The flow, its *short of the field* badge, and `todayPace('market')` in `dial.ts`,
   which the pipe drawn across and the dial read. It should read the Market amount.
2. **Sales' sold a week.** `demandPace.ts` (`buildDemand`) counts a bid as sold when it is marked won, and also
   when a job was made from it. Under the rule only the mark counts.
3. **The Sales window's inputs.** `Bridge.tsx` still hands the Sales kernel the old fallback rate
   (`marketWinShare`) and the old estimate share for an asker with few decided bids. They should be the rate
   for the bid's size and the estimates' won rate. `loadSalesDesk.ts` drops a bid a job was made from out of the
   open pile, so an unmarked one is in neither list. Under the rule it is still out.
4. **`loadMarketDesk.ts`** still reads the jobs made from bids. Nothing uses it now.
5. **The weekly email.** `bridge-weekly-sheet` builds the first screen from `weekCall.ts`, `flowStrip.ts`,
   `stageFlow.ts`, `dial.ts` and `demandPace.ts`, all copied to the edge functions. It still draws Market the old
   way. Moving it means adding the new kernels and loaders to `scripts/edge-kernels.mjs`, running
   `npm run gen:edge-kernels`, and redeploying every function `npm run check:edge-drift` names.
6. **The guide and the docs.** `src/content/help/the-bridge.md` still says *asked*, *win share* and the old band
   names in its Market and Sales parts. The Glossary and `PROJECT_DOCUMENTATION.md` follow.
7. **Old fixture names.** `marketDesk.test.ts` and `salesDesk.test.ts` carried company names on `main` before
   this work. Swap them for made-up ones when those files are next touched.

### Offered to the owner and not asked for

Do not build these unless he asks.

- A note on each bid's row on the Bid Board: *bids this size: N% won*.
- A row in Soft numbers for the old bids with no mark, with a door to them.
- Sizing the pipe's widths straight to the dollars, so the five steps look less alike.

## The plan

Each PR is cut from fresh `main`, takes its files from the spike branch, and ships with its tests, its release
note and fragment, and its docs, per `CLAUDE.md`. Claim a version for each.

| PR | What | Size |
|---|---|---|
| 1 | **Shipped, v2.6973.** **The pipe stands up, with Market worth on it.** The standing pipe is the spike's candidate 2 and carries the Market row, so it goes first: `flowStripDown.ts`, `BridgeFlowStripDown.tsx`, `stripSide` on `BridgeWeek.tsx`, then the two won-rate kernels, their loaders and tests, and `withMarketWorth`. Until the left-out list ships, the loaders take an empty list. | M |
| 2 | **Shipped, v2.6975.** **Won by bid size on the Bid Board.** `BidBoardWonBySizeSection.tsx` and its place in Health. Add a render test. | S |
| 3 | **Shipped, v2.6977.** **The frame, with the Market and Sales windows.** `BridgeStepWindow.tsx`, the two windows, their new kernels and the two changed kernels. The other three windows can ride here or in their own PR. | M |
| 4 | **Shipped, v2.6979.** **One rule on the page.** Items 1 to 4 above: the Market card, the badge, the pace the across pipe reads, Sales' sold a week, the Sales window's inputs. `stageFlow.ts`, `dial.ts` and `demandPace.ts` are copied to the edge functions, so regenerate the copy in this PR. | M |
| 5 | **Shipped, v2.6983.** **The weekly email.** Item 5. Dry-run the function and read its Market line before the redeploy. | M |
| 6 | **Shipped, v2.6988.** **The guide and the docs.** Item 6, and item 7 if not done on the way. | S |

## How to verify

- **The rules**: `npx vitest run src/lib/bridge/bidWins.test.ts src/lib/bridge/estimateWins.test.ts`. Every
  rule above has a test with its name in plain words. Every sentence the kernels print is held to
  `plainWordsFailures`.
- **The page**: `npm run dev`, then `/dev-login?as=1&to=/bridge`. It signs in as a dev on production data. Read
  only. Press nothing that records.
- **The figures**: the working is one press under the pipe, *How Market's figure is counted*. Check each count
  against a read-only query of `bids` and `estimates`: sent bids by outcome and by size, unmarked bids by age,
  estimates by status and by age.
- **The windows**: press a section of the pipe. Each window should open at about one phone screen, with every
  press at least 44 px tall and no sideways scroll at 390 wide.
- **The Bid Board**: `/bids?tab=bid-board`, then the Health chip. Switch the trade and the chart should follow.

## Gotchas hit on the way

- **The repo is public.** A PR body that quoted live dollars and hours was refused. Keep real figures and real
  names out of commits, PR text, tests and to-do pages. Made-up names only.
- **Outcome dates are mostly empty on won bids.** Time to a win was read from the day the bid's job was made.
  Do not build on `outcome_at` for wins.
- **A few very large bids carry any rate by dollars.** That is why the rate is by size.
- **Some won bids carry no dollar value.** They count as won for nothing unless a job gives a revenue. The words
  say how many.
- **Do not run a formatter on existing files.** They keep long lines, and a formatter rewrites whole files.
- **`src/lib/bridge/collect/` and many top-level Bridge kernels are copied to the edge functions.** Check
  `supabase/functions/_shared/gcKernels/lib/bridge/` before editing one, and regenerate when you do.
- **A hidden browser pane refuses the local server.** Walk the page with the repo's Playwright in a script that
  refuses every non-GET request to the tables.

## Where it stands

Checked on 2026-11-13 against `main` and against production, read only. Nothing on this card's plan is left to
build. What is left is seven short questions for the owner and his read of Monday's email. Call 7 is answered
and built.

### The owner's calls

Each takes one word. The pick is the builder's, and it stands until he says otherwise.

1. **Is *the scaling function* the step that moves the fewest dollars a week?** Pick: **yes**. That is the reading
   card #321 draws (`to-dos/bridge-narrowest-step/`), and #321 builds nothing before this answer. A yes costs M
   there, or S for the row directions alone. The question lives on #321 from here on.
2. **Should Sales' line *sold $X of work a week* count only the bids marked won?** Pick: **no**. PR 4 left the line
   as the contract on the jobs made in the window. That is work handed to the field, and the Sales window already
   reads the pile at the won rates. A yes is S: `buildPace.ts` feeds the line, the kernel is copied to the edge
   functions, and the functions that read the copy are redeployed.
3. **Does the first screen still need its budget of 150 words and 24 numbers?** Pick: **no, drop the question**.
   PR 1 found the standing pipe put the usual week at 161 words and 27 numbers. #334 then took the week's call off
   the page (v2.7105), so the screen that budget measured is gone. The test still holds the card the email prints.
   Nothing to build.
4. **A note on each bid's row on the Bid Board, *bids this size: N% won*?** Pick: **no**. Bids → Pricing already
   says how bids this size went, on the bid's title line. A yes is S.
5. **A row in Soft numbers for the old bids with no mark?** Pick: **no**. The Market and Sales windows already ask
   for those marks, each with a door to the Bid Board. A yes is S.
6. **Size the pipe's widths straight to the dollars?** Pick: **no**. #321 answers the same worry, that the five
   steps look alike, by lighting one of them. A yes is S.
7. **Fix the Bid Board's Pulse so a bid sent on a Sunday counts in its own week?** **Done.** It was fixed as
   v2.7170, on a yes of 2026-11-13. The look is written under *Looked at* below.
8. **Retire this card now, or after Monday's email is read?** Pick: **after Monday**. The reason is under *When
   this card closes*.

Calls 4 to 6 are the three under *Offered to the owner and not asked for*.

### What was checked on 2026-11-13

- **The commits.** All seven are on `main`: PR 1 (#7725), PR 2 (#7727), PR 3 (#7729), PR 4 (#7731), PR 5 (#7733),
  PR 6 (#7741) and the visual pass (#7758). #7754 took the weekly email's kernels off the shared index so
  `customer-portal` fits a deploy. Each version has its release note and its fragment.
- **The code today.** The one win share is gone: nothing in `src` or `supabase` names `marketWinShare`. The page
  builds the won rates once and hands them to the pipe, the Market card, the dial and both windows. Sales counts a
  bid by its mark alone. `loadMarketDesk.ts` reads no jobs. The guide has *What Market is worth* and no *win share*.
  The train's rule tests and render tests pass, 170 tests in 18 files.
- **Every item under *Not built: the rest*.** Items 1 to 7 are each in the code as the plan says. Nothing was
  skipped.
- **Production.** `npm run check:edge-drift` reads every repo function as deployed and current, `bridge-weekly-sheet`
  among them. The email's switch, `bridge_weekly_sheet_on_v1`, reads `true`. Its last run is empty and the send log
  holds no weekly mail, so Monday is the first send. The schedule is the one `20261026120000_bridge_weekly_sheet.sql`
  set, Mondays at 11:00 and 12:00 UTC, and the function runs only the tick that is 6 AM Central. The dev seat cannot
  read the scheduler's own row, so the schedule was read from the migration and not from production.

### Where #334 built on top of this train

Nothing this train built was taken away. Four pieces were changed again by #334 (`to-dos/bridge-pulse/`):

- **PR 1's left-out list.** The loaders took an empty list. Since v2.7095 the page hands them the list a person
  saved. The saved list is the one the owner set. It names two developments today, and one is the ZZ test one.
- **PR 1's place for the pipe.** It stood beside the call's card. The call left the page in v2.7105, and the card
  beside the pipe is What to do now since v2.7109.
- **PR 3's Market window.** Its two amounts are presses since v2.7120, and each opens what makes it up. The
  estimates' won rate leaves out ZZ test estimates since v2.7119.
- **PR 5's email.** Two open PRs change it: #7893 takes the call out of the mail, and #7948 makes the mail read
  the left-out list.

### What Monday's email carries, as things stand

The deployed function is `main`'s. On Monday 2026-11-16 at 6 AM Central it mails the owner and every dev with a real
account. As deployed today the mail holds the three tiles, the pipe with Market read as *worth*, one line for what
the bids win and what the estimates sell, and the week's call.

Two things in it will not match the page:

- **It counts everything.** The mail does not read the left-out list. The page leaves out what the list names, so
  the mail's Market amount and its other figures will differ from the page's. #7948 fixes this.
- **It still carries the week's call.** Its button sends the reader to the Bridge to make the call or answer it,
  and the page has had no call since v2.7105. #7893 fixes this. It is third in #334's stack and carries a migration to push.

For Monday's mail to match the page, both PRs are merged and `bridge-weekly-sheet` is redeployed before Monday
12:00 UTC, then a dry run is read. Neither PR is this card's, and nothing was deployed from here.

### Looked at: the Pulse's weeks on the Bid Board

A bid's send day is a date with no time. `estimatingPulse.ts` and `bidBoardWeeklySentStats.ts` read it through the
helper for a moment in time, which takes a plain date as midnight UTC. That is the evening before in Chicago, so
each bid lands a day early. Only a Sunday send changes weeks: it counts in the week before. None of the bids sent
since May 2026 carries a Sunday send day, so no week on the board was wrong. Since v2.7170 both kernels read the
date as written (`ymdFromDateLike`), and their tests feed a plain date. Until then the tests fed a time, which the
column never holds. It was call 7.

### When this card closes

Close it after Monday's email is read. Everything on the plan is built, live and checked, and by the owner's rule
of 2026-10-06 a look does not hold a card open. This is more than a look. The mail has never been sent, and the
Market amount is this card's own figure. As deployed, Monday's mail will show an amount the page does not. Once the
mail and the page agree on it, delete this folder in its own PR, on the owner's word. The branch
`spike/bridge-scaling` is still on GitHub and can go with it.

### How each PR landed

Rules set, built on the spike branch, walked and kept by the owner on 2026-11-11.

- **PR 1 shipped as v2.6973.** The pipe stands up, beside the call's card at a desk. Market's row reads what the
  asks are worth, with the working one press under the pipe. The loaders take an empty left-out list, and
  `leftOut.ts` holds the rule alone. *How the week runs* left the first screen with it, as the owner said on the
  walk. Walked at desk and phone width with every count held beside a separate read of the rows.
- **PR 2 shipped as v2.6975.** The chart sits in the Bid Board's Health section under the Pulse and follows the
  trade. The spike read a bid's send day as an instant, which lands a day early; the chart reads the date as
  written. It has a render test now.
- **PR 3 shipped as v2.6977.** The frame, and the Market and Sales windows on it, with the mark-only rule and the
  plain words in `marketDesk.ts` and `salesDesk.ts`. Each window opens at about one phone screen with every
  press 44 px tall. The Build, Bill and Collect windows were rebuilt on the frame on the spike too; they are not
  on this card and did not ride along. The frame has a render test now.
- **PR 4 shipped as v2.6979.** The Market card, its badge, the dial and the usual fixes read the Market amount,
  and the one win share is gone from the code. Sales counts a bid by its mark alone. A marked win with no answer
  day is dated by the day its job was made, and the loader now reads the bids behind the window's jobs. In the
  Sales window an asker with few marked bids is read at the rate for bids the size of each ask, and a bid a job
  was made from stays in the pile. `loadMarketDesk.ts` no longer reads jobs. The five functions that read the kernel copy
  (`bridge-weekly-sheet`, `customer-portal`, `drive-link`, `gc-trade-portal`, `photo-save`) were redeployed on
  2026-11-12.
- **PR 5 shipped as v2.6983.** The weekly email reads every bid and estimate ever sent and hands the Market amount
  to the same kernels as the page. Market on its pipe reads *worth*, with one line for what the bids win and what
  the estimates sell. Built locally on the page's reads before any redeploy and held beside the deployed
  function's own dry run: every other line of the two mails is the same. `bridge-weekly-sheet` was redeployed
  from `main` on 2026-11-12 and its dry run reads Market as *worth*, so the first send, Monday 2026-11-16 at
  6 AM Central, carries it.
- **PR 6 shipped as v2.6988.** The guide has one section for the rule, *What Market is worth*. The Glossary and
  `PROJECT_DOCUMENTATION.md` follow. The fixtures in `marketDesk.test.ts` and `salesDesk.test.ts` carry made-up
  names.
- **A visual pass shipped as v2.6998**, after the train was live. The pipe, both windows and the Bid Board's chart
  were read at 375, 768 and 1400 px in light and dark. Nothing spilled or was cut. Four things were tidied: the
  pipe's five names fall at even steps, Market's working reads as two blocks, the chart's empty track shows in
  light, and in the Sales window a reason's dollars stay on its own line on a phone.

Left out on purpose, each its own change:

- **What the Bridge leaves out** (the list, its picker and the migration for the owner's role), **the header's
  *reads the last 8 weeks* line**, and **the Build, Bill and Collect windows on the shared frame**. All three were
  walked on the spike and shipped under #334 (`to-dos/bridge-pulse/`): the windows and the header's line as
  v2.7089, the list as v2.7095. None was on this card's plan.
- **Names in other test files.** v2.7087 swapped the names in the test fixtures across the repo for made-up ones, and
  `collect/collectScorecard.test.ts` left with the week's call in v2.7105. This card named two files.
- **The Pulse's weeks on the Bid Board** read a bid's send day, a date, as an instant. The new chart reads it as
  written. The look was taken on 2026-11-13 and is under *Looked at* above.
