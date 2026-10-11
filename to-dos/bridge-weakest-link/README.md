---
name: "The Bridge as the weakest link: build the prototype"
number: 106
group: ready
status: building on claude/bridge-link-* branches from 2026-10-11 · PR 1 the kernel, the rule and the five cards (v2.5232, #5400) · PR 2 the calls (v2.5233, #5401) · PR 3 Build by percent (v2.5234, #5402) · PR 4 Market and Sales (v2.5235, #5403) · PR 5 the dial (v2.5236, #5404) · PR 6 resources and the order (v2.5237, #5405) · PR 7 everything else waits (v2.5238)
summary: >
  The Bridge opens on one rule, reads the company as five stages and three resources, lights
  the weakest link, and gives the owner a dial, a record of the week's call, and a breakdown
  behind every number. The prototype is finished; this is the list of everything it changes,
  the PR train to build it, and the review of that train.
next: PR 1, the stage-flow kernel; the owner's three data decisions can run alongside.
size: L (13 PRs; the kernels are S each, the three breakdown panels are the M)
blocker: none for PRs 1–9; the Build measure wants percents on the 36 open jobs without one; the cash breakdown wants the Mercury-versus-typed question answered.
opinion: build — the page already does its job as a reading; the prototype turns it into the weekly loop the owner asked for.
---

# The Bridge as the weakest link: from the prototype to the app

The prototype: https://claude.ai/artifact/2GciUJPCjaTysjpTEULWyJ, artboard E, version 77 on 2026-10-11. A static render of its opening state is `prototype.html` beside this file. The notes that fed it: `notes/the-goal-limiting-step.md` (the book's frame and the Build-by-percent proposal).

## The ask, in the owner's words

"The purpose of the bridge in the app is to help the user solve these bottlenecks. What if we used the bridge as a guide to identify what bottleneck is going on. Where whenever the user sees the bridge, they are first prompted a business is only as good as its weakest link, so grow throughput through that link instead of cutting cost everywhere. And then show the six links as buckets." Later: "I love the Last 8 pay weeks chart, let's keep that. Let's put the 5 buckets below it." And: "I want everything built to be added so I can begin making suggestions that don't exclude anything."

## The decision

The owner iterated on artboard E across 77 versions and picked every piece in it. Rejected along the way: the six buckets as a separate page (cut C) and the three-stop walk (cut D) as the opening; a one-sentence lever under the slider; a seven-row list of the other links' levers as a section; the four reflex presses under the dial (they live in the waits section). Two open owner decisions do not block the build: Mercury's $390 against the typed $32.1k (which cash figure the page trusts), and the 18 won bids with no decision date (date them, count them by sent month, or let the job link set the day). A third, the prospect list's fate, only touches Market's reading.

---

## First pass: every change from the built page to the prototype

Section by section, top to bottom. "Built" is `/bridge` on main today (v2.5224). "New" is in the prototype and not in the app.

### 1. Header
- **Built:** title, Monday sheet, Refresh, Approved only.
- **New:** the date as "Friday, Oct 10, 2026"; an "Oct 4–10" chip that toggles a dashed highlight on everything scoped to the pay week, off by default; a red chip "last call: Decision · did not move" that jumps to the scorecard.

### 2. The rule
- **New:** one line under the header, "Find the slowest step. Everything waits on it. We measure the week by what the field earned, billed and paid." A "?" at its right opens, on hover, focus or press, the long rule and five aphorisms from *The Goal* in our words.

### 3. The headline and the eight bars (kept, extended)
- **Built:** +$38k this week; eight pay-week bars of approved contribution, hatched where hours wait; hours under each bar.
- **New:** the stat block reads "+$38k · this week · 317h of field time clocked" with three chips (80h approved · +$9.7k; 237h waiting · the rest; office 89h waiting · not in the 317h), each with hover text that makes the arithmetic add up. Each bar is a button: hover, focus or press opens a card with the week's earned less wages, hours, sessions, people and dollars an hour, the three jobs that made the week with bars and "N more", and the verdict against the 8-week average; a waiting week's card ends in amber with "about $38k once approved. Approve on the schedule." The bars are drawn from data, so approving hours turns the hatched bars solid.

### 4. Where the work piles up (new section)
Five cards, Market → Sales → Build → Bill → Collect, in flow order. Each card: NAME and its object on one line, an action pill under it ("bill the day it finishes"), the pile with its one or two sub-lines, two lines of flow with a subject ("the field finishes $34k a week" over "the office bills $22k a week"), a weeks line ("10.6 weeks to bill what is already finished"), and a badge. The badge is a press that opens the order modal (section 8).
- Market reads bids invited and estimates requested, by value, over 8 weeks; "not short".
- Sales reads a SENT / WON / LOST table for bids and estimates, and "sold $49k of work a week" over "the field builds $35k a week"; "ahead of the field · wait". Sold is counted by the contract on jobs created, because bid wins carry no date.
- Build reads $362k left to build on the 28 jobs with a percent, a grey share for the 36 without, "10–14 weeks to build what is already sold"; "a close second · set the %s".
- Bill is lit red: $233k finished and not yet billed, 10.6 weeks; "the weakest link".
- Collect: $332k billed and not yet paid, 49 invoices late, 7.2 weeks; "long · moves with Bill".
- The rule: the weakest link is the pile stage with the most weeks to clear what is already waiting; Market and Sales feed the field and read by pace against it.

### 5. The dial (new)
"Exploit before you elevate · Bill · billed a week." A slider for the lit stage's pace, with marks on the track (today; the pile stops growing; above here Build is the link; a second biller from here), the track shaded blue for exploit and amber for elevate with the two zone labels, the number with a unit under it ("about 1.4 jobs a week"), a sparkline of the pile over 12 weeks at the chosen pace with today's dotted, and three readings: the pile, the link, the money. The cards above move with the dial: weeks lines, in and out, and the red badge. Each stage has its own dial (Sales by win rate, Market by asks).

### 6. What throttles the link (new)
Three cards, Decision, Capital, Talent, with one-line heads ("DECISION bottlenecks at the leadership level"), an action pill, a gauge ("4 piles on you", "$390 in the bank", "7 in the field · 1 billing") and a badge ("throttles the link", "symptom of the link"). Pressing one keeps Bill's dial.

### 7. The lit link's desk (new)
For the pressed card: what it is, why it matters to throughput, how the Bridge reads it, today's reading, the moves this week would make, and the green "This is the link this week: Bill" that records the call.

### 8. What to deal with first (new modal)
Opened from any badge. The rule in one line, then five tiers: First (the link), With it (what throttles it), Next (the link once the first moves), Follows (moves when the link moves), Waits (ahead of the field). Each row: rank, name and badge, the reading that put it there, and the first move. The pressed badge's row is highlighted with a line naming its tier and why. The order follows the dial.

### 9. Everything else waits (rebuilt)
Four presses, one per row: Hire another plumber, Push for more bids, Add a field day, Cut overhead 10%. Each sets the dial and the cards to what the move would do and shows one line under it ("$17k a week waits unbilled instead of $13k. The link did not move." / "Nothing above moved. One finished job billed is about $15k."). A "?" in the card's corner keeps the old list of the other links' levers. Footer: "They come back when the link moves. Friday asks whether it did." with "back to today".

### 10. Last week's call, against what moved (rebuilt)
A scorecard: the link, who called it and when, the streak ("2nd week running"), a red "did not move" chip; a moves table with owner, then → now, done; the link's measure then → now; and the consequence in amber ("Second week on Decision with nothing moved. Both moves sat with one person. This week either the moves get other owners, or the call changes."), which at three weeks becomes "elevate: spend on it, or change the call."

### 11. The two constraints, Truth check, This week, Fix the reading, Bills, Receipts, People (kept as built)
Unchanged, with one wording change: the cash constraint reads from the bank's balance.

### 12. Daily profit rate, Money owed, Crew hours (kept, each now a press)
Each card is a press with "▾ chart"; one panel opens under the row. Every panel has the same four parts:
- **Daily profit rate:** earned against costs by pay week with the net as bars, hatched where hours wait; an "Approve the 585h" press that turns the hatched weeks, the card's number (−$2,033 → +$2,143), the Crew hours card and the headline bars; a waterfall of the 14-day average (earned, field labor, materials, subs, overhead, profit a day); a five-row table of where each input is read from, what can make it wrong, and the door; a break-even line.
- **Money owed:** owed to you by how late (five buckets with counts) beside owed by you by when due; a waterfall (cash, owed to you, supply bills, payroll owed, sub labor, net position, not yet billed, once billed); a six-row sources table; the net position line.
- **Crew hours:** hours by week stacked (approved field, waiting hatched, office); a waterfall of this week's hours (clocked, waiting field, waiting office, read by the page, field, office); a five-row sources table; the rule line ("the unread 237h is about $28k of this week's +$38k").

### 13. Net position (kept, with a press)
"▾ break it down" opens a waterfall of the 8-week change (Aug 15, cash, owed to you, owed by you grew, today), a four-row sources table whose cash row is red because the chart uses the typed figure while the forecast uses the bank's, and the line against the paper profit.

### 14. Cash, next 8 weeks (kept, with a press)
The bank's balance in the header; "▾ break it down" opens a waterfall of the window (bank today, promised, by pace, late assumed, supply bills, payroll, sub labor, office parts, end of window), an eight-row sources table (the floor row notes that $5k is under one Friday's payroll), and the lowest-point line.

### 15. Vectors, who moved the number (kept, regrouped)
Two groups with a header row and a subtotal row each: Field (master, super, field, sub: all of the contribution) and Office & estimators (office, dev, estimator: all of the billing, collecting and bids), rows sorted by contribution then by hours waiting; the Company row keeps the waiting hours too.

### 16. Vectors, by the day (kept, three readings)
Revenue · Profit · Cost buttons beside the Days/Weeks/Months controls. Profit is the grid as built (earned at the job's rate less the wage); Revenue is the earned figure, blue, with a no-price day reading 0; Cost is the day's wages, amber. The subtitle, the week column, the totals with hours and dollars an hour, and the Field crew row follow the mode.

### 17. Monday sheet (kept; should follow)
The sheet should carry the rule, the lit link with its weeks, the three readings at today's pace, and the scorecard. Not drawn in the prototype.

### What the prototype assumes that the app does not have yet
Every number on the page must trace to a loader field. These are the gaps, by section:
- **4, Sales:** bids and estimates sent, won and lost by value in the window; sold per week by the contract on jobs created. Bid wins carry no date before v2.3354 (18 undated); counting by jobs created sidesteps it.
- **4, Market:** bid invitations and estimate requests with values; 7 bids in the window have none.
- **4, Build:** built per week = Σ (percent now − percent before) × contract, from `job_pct_events` and the reports' percent history by date (today only the latest report percent is read); the pile from open jobs' percent and contract; a half-done rule for the 36 jobs with no percent.
- **4, Bill and Collect:** billed per week and collected per week over the window (invoices by sent day, payments by day; both already loaded for the net position line).
- **5, the dial:** the exploit/elevate boundary per stage (a second biller at $40k, another crew at $50k, the Lien desk at $60k) is an owner setting, not a read.
- **8–10, the calls:** a `bridge_calls` table: the link, who, when, the moves with owners, and a JSON snapshot of the measures at call time so the scorecard's then → now is real.
- **3, the week cards:** sessions grouped by job and pay week; the loader has sessions by day and job, so this is a group-by.
- **12, the panels:** the per-day splits of direct cost (field labor, materials, subs) are in the loader's totals; AP's supply, payroll, upcoming and sub labor totals are in the finance hook; invoice aging buckets need an age-from-sent read.
- **14, cash:** the Mercury balance is read (v2.5219); which figure the page trusts is the owner's call.

---

## Second pass: the plan

Twelve PRs, each one change, each with its kernel and unit tests, a render smoke, a release note, a `docs/recent-features/` fragment, and the `the-bridge` guide updated when a flow changes. The Bridge is dev-only, so nothing ships behind a flag. Order chosen so the loop (the calls) lands early and every later PR has something to record against.

| PR | What | Touches | Needs | Size |
|---|---|---|---|---|
| 1 | **Stage flow kernel, Bill and Collect** — piles, in and out rates, weeks to clear, the nomination rule, the badge words. Pure `.ts`. | `src/lib/bridge/stageFlow.ts` + test; reads from `loadBridgeData` (RTB, AR, invoices by day, payments by day, earned pace) | nothing new | S |
| 2 | **The five cards and the rule** — the header date and week chip, the rule line with its "?" popover, the five cards drawn from PR 1 with Build, Market and Sales reading "not readable" until PRs 4 and 5. | `BridgeRule.tsx`, `BridgeStages.tsx` + render tests; `Bridge.tsx` | PR 1 | M |
| 3 | **The calls** — migration `bridge_calls` (link, called_by, called_on, moves jsonb with owners, measures jsonb snapshot, outcome); the lit link's desk with "This is the link this week"; the scorecard with then → now from the snapshot and the streak; the header chip. | migration + `docs/migrations/`; `src/lib/bridge/calls.ts` + test; `BridgeLinkDesk.tsx`, `BridgeLastCall.tsx` | PR 2 | M |
| 4 | **Build by percent** — the kernel from the Build-by-percent proposal: percent deltas × contract by pay week, the open-jobs pile, the half-done rule and the grey share; one read of the reports' percent history by date. | `src/lib/bridge/buildPace.ts` + test; a loader read (`list_job_pct_history` or a view) | PR 1; percents set on the 36 jobs make it honest | M |
| 5 | **Market and Sales** — bids and estimates sent/won/lost by value in the window; asks; sold per week by jobs created; the SENT/WON/LOST table and the pace lines. | `src/lib/bridge/demandPace.ts` + test; loader reads on bids, estimates, jobs | PR 1 | M |
| 6 | **The dial** — marks, zones, unit, the 12-week sparkline series, the three readings, the cards moving with it; the exploit/elevate boundaries as `app_settings`. | `src/lib/bridge/dial.ts` + test; `BridgeDial.tsx`; `BridgeStages.tsx` takes an override | PRs 1, 4, 5 | M |
| 7 | **The three resources and the order** — Decision, Capital, Talent cards from the hygiene counts, the bank and the crew; the order modal's tiers from PR 1's output. | `src/lib/bridge/resources.ts`, `order.ts` + tests; `BridgeResources.tsx`, `BridgeOrderModal.tsx` | PRs 1, 6 | S |
| 8 | **Everything else waits** — the four presses as dial presets with their result lines; the levers popover. | `BridgeWaits.tsx`; presets in `dial.ts` | PR 6 | S |
| 9 | **The week cards on the headline bars** — sessions grouped by job and pay week; the card; bars as buttons; the hatched bars drawn from the same data. | `src/lib/bridge/weekCard.ts` + test; `BridgeHeadline.tsx` | nothing new | S |
| 10 | **The Daily profit rate panel** — the trend by week from the loader's by-day maps, the waterfall from the totals, the sources rows from the hygiene counts, break-even; the card as a press. | `src/lib/bridge/profitPanel.ts` + test; `BridgeCardPanels.tsx` | nothing new | M |
| 11 | **The Money owed and Crew hours panels** — aging buckets (age from sent day), due buckets from AP, the two waterfalls, the sources rows, the hours stack. | `owedPanel.ts`, `hoursPanel.ts` + tests; `BridgeCardPanels.tsx` | PR 10's panel frame | M |
| 13 | **The people tables** — Field and Office & estimators groups with subtotals on Vectors; the Revenue · Profit · Cost mode on the by-the-day grid (one kernel, a mode switch; each session already carries hours and the person's rate). | `src/lib/bridge/vectors.ts`, `vectorDays.ts` + tests; `BridgeVectorsPanel.tsx`, `BridgeVectorDaysPanel.tsx` | nothing new | S |
| 12 | **Net position and cash breakdowns, and the Monday sheet** — the two "break it down" presses; the sheet carries the rule, the link, the readings and the scorecard. | `netPanel.ts`, `cashPanel.ts`; `BridgeMondaySheet.tsx`, `mondaySheet.ts`; the `bridge-sheet-email` function's text | PRs 3, 6; the Mercury decision for the cash rows | M |

Alongside, not in the train: the owner dates or re-counts the 18 won bids; sets percents on the 36 open jobs; decides the prospect list; answers Mercury versus typed. Each is a Fix-the-reading row already on the page.

### How to verify
- Sign in with `http://localhost:5173/dev-login?as=&to=/bridge` (the dev-login secret must match `.env.local`).
- After PR 2: the five cards show today's reading; Bill is lit; the badge words match `stageFlow.test.ts`.
- After PR 3: press "This is the link this week", reload, the scorecard shows the call with the snapshot; the Monday sheet email (`bridge-sheet-email`, mails the caller only) carries it once PR 12 lands.
- After PR 6: drag Bill to $35k and the red moves to Build; press "back to today".
- Approve hours on the schedule, Refresh, and the hatched bars, the profit card and the hours card all turn at once (PR 9 and PR 10).
- Hover cards and the modal: verify with Playwright, not the browser pane (the pane's hidden state drops rAF and hover).
- Prod reads are read-only through the app's own signed-in client; never write test calls against real weeks without the owner's yes.

---

## Third pass: is this the best we can do?

Read the plan against the page it builds, and against the book. Six things change it.

1. **The calls are the product; everything else is a reading.** Without `bridge_calls` the page is a dashboard with a slider. PR 3 is already early; it should also be the first PR the owner uses for real: call the link on the Monday after it lands, so PRs 4–12 are built against a recorded call and a Friday that asked whether it moved. The plan stands; the practice is the point.

2. **The nomination rule is fragile where it matters most.** Bill at 10.6 weeks and Build at 10.3 are a pair; a $1k change in billing flips the red. The dial shows that honestly, but Monday should not re-nominate on noise. Add hysteresis to PR 1: a recorded call holds the link for its week; the page shows "would be the link at today's reading" when another stage overtakes, and only nominates fresh when no call stands or the overtaking stage leads by 15% or more. Also name the pair: when two stages are within 10%, the badge reads "the weakest link, with Build" and the desk's moves include the pair's shared first move (set the percents, bill the finished work).

3. **Two cash figures on one page is a defect, not a decision.** The net position line uses the typed $32.1k; the forecast uses Mercury's $390. The owner's question is which to trust, but the page should not wait on it: PR 12 should make the typed figure a fallback, used only when the bank read fails, and show the gap as one Fix-the-reading row ("the bank reads $390; the app's flows say $32.1k; $31.7k of flows are not in the app"). That is the honest reading and it removes the red row in the net position breakdown.

4. **The Build measure should ship with the guess shown, not wait for the percents.** PR 4 reads 28 jobs truly and 36 as half done; the grey share on the card is the prompt to fix it. Shipping it after the percents are set would hide the reason to set them. Keep PR 4 where it is and let the grey bar do its work.

5. **Cut before building: the three breakdown panels are the cost center.** PRs 10–12 are three M-sized PRs of charts. Ship the profit panel first (PR 10), because its Approve-turns-everything story is the one the owner reacted to, then watch whether the owed and hours panels get opened before building 11 and 12 in full. If they are not, the sources tables alone (no waterfalls) carry most of the value at a third of the cost.

6. **What is missing from the plan.** Friday. The loop is Monday calls, Friday asks; the page has no Friday surface. Add to PR 3: on Friday (or on the first open after it) the scorecard's "What moved" fills itself from the snapshot against today's reading, and the header chip reads "Friday: did the link move?" until someone presses yes or no. Also missing: the help guide's plain-words pass on every sentence the page shows, not only the guide; the readings were written to the guide's rule, and `plainWords.ts` should be applied to the kernels' sentence builders in tests, so a future edit cannot drift.

With those six folded in, the train is the same thirteen PRs in the same order (PR 13, the people tables, can go any time after PR 2 since it touches nothing the others do), with PR 1 carrying hysteresis and the pair, PR 3 carrying Friday, PR 12 carrying the cash fallback, and PRs 11 and 12 gated on whether the first panel is used. That is the best version of this plan I can see today.

## Where it stands

Designed 2026-10-11 on the canvas; the owner said build it the same day. Nothing in the app. Next: claim a version and open PR 1; the owner dates the 18 won bids, sets the 36 percents and answers Mercury-versus-typed alongside.
