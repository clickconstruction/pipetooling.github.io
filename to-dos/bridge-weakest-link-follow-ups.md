---
name: "The Bridge, weakest link: follow-ups after the train"
number: 107
group: ready
status: PR A merged 2026-10-11 as v2.5244 (#5414); B–F open
summary: >
  A holistic pass over the weakest-link build: four readings that can mislead (Build's pace by
  percent, Bill's in-rate on approved time only, Collect's pile counting current invoices,
  Market's "not short"), four bugs, a handful of words that lead astray, and the next small train.
next: PR B, Collect's weeks on the late pile with the current share grey; then the rest of B.
size: M (five small PRs left; B changes what the red says, Collect holds the link today at 13.8 weeks on a pile that counts current invoices)
blocker: none; the percents on the open jobs are the owner's and would fix half of PR B by themselves
opinion: do B before the first Monday call; A moved Build from 15–17 weeks to 9–10 and the link to Collect
---

# The Bridge, weakest link: follow-ups after the train

Written after the twelve PRs landed (plan and prototype history in `docs/recent-features/v2.5232.md` … `v2.5243.md`; the prototype at https://claude.ai/artifact/2GciUJPCjaTysjpTEULWyJ, artboard E). What follows is ranked by what changes the page's verdict first.

## Calculations that can mislead

1. **Build's pace reads low, and that makes Build the link.** `buildPace.ts` reads built-per-week from percent deltas × contract. Today 14 of 27 open jobs have no percent and the reports are the only percent source for most, so built reads about $24k a week against the hours-based $34k the top line earns. On that reading Build clears its pile in 15–17 weeks and takes the red from Bill (10.8) and Collect (13.8). The number is honest about what the app can read, but the verdict is not: the field did not slow, the percents are thin. Fix: feed `fieldPerWeekUsd` the larger of the percent pace and the hours-based pace (`totals.earnedUsd ÷ weeks`), show both on the Build card ("by percent $24k · by hours $34k"), and when the grey share is over a third, keep the nomination on the known stages unless Build leads by the pair margin. Also put "· set the %s" on Build's badge when it is the link, not only when it is the pair.
2. **Bill's in-rate is on approved time only.** `Bridge.tsx` feeds Bill `data.totals.earnedUsd ÷ 8`, which is approved sessions. With 585h waiting it reads low, so "the field finishes $34k a week" understates the field and the pile grows faster than the card says. The top line already solves this with recorded time; use the headline's recorded weeks (`headline.weeks` recordedUsd summed, less wages added back) or the earned-revenue kernel on recorded sessions. The dial's "Of the field's $34k a week" and the reflex lines inherit the same bias.
3. **Collect's pile counts invoices that are not late.** *Closed 2026-10-25 by v2.5856 (punch list #177, PR E): the card's weeks read the bills past their day by each payer's own pace, the Collect desk's pile, with what is not yet due grey and never a guess.* `weeksToClear(ar.total, paidPerWeek)` divides every open invoice, current ones included, by the window's collected-per-week. A current invoice is not waiting on Collect yet. Read the weeks on the late pile (the aging buckets past 30 days, which the Money owed panel already computes) and show the current share grey, the way Build shows its guess.
4. **Market's "not short" is apples against oranges.** `demandPace.ts` compares asks-in per week by bid value ($308k) with what the field builds ($35k). Asks are not demand that converts; on that comparison Market will read "not short" for as long as a single large bid is invited. Compare sold-per-week to the field, or asks × the window's win share by value, and say which.
5. **Bill's out-rate is every invoice sent, the pile is finished work only.** ~~Progress bills on jobs still working count in "the office bills $X a week" while the pile is the ready-to-bill rows.~~ **Closed 2026-10-24 by v2.5833 and v2.5834**, the other way round: the pile was never the ready-to-bill rows but the Dashboard's Not billed bucket (the whole unbilled contract on every working job, $260k where the finished share was $39k), and the out-rate missed every bill marked billed by hand ($266k of the window, the GC pay applications). The pile now reads percent done × contract − billed per job with the no-% jobs grey (`billPile.ts`), and a bill counts on its send day, else its billed day (`billedDay.ts`). The two populations now match: work finished against bills on the same jobs.
6. **The scorecard's "moved" is noisy.** `callVerdict` reads moved when the link's weeks fell by a tenth. Weeks fall when the pile shrinks, when the out-rate rises, or simply because the 8-week window rolled a strong week in. Read the pile dollars alongside, and call it moved only when the pile fell too.
7. **The reflex presses size themselves from the thin Build pace.** "Hire another plumber" adds 40h × (built-per-week ÷ field hours); with built reading low the press understates what a plumber finishes. Follows from 1.

## Bugs

1. **"0 billing" when the sender is not recorded.** `resources.ts` counts billers from invoice-send events that carry a user id; sends recorded without one leave the gauge at "0 billing" while the window shows bills going out, which reads as nobody at the desk. Fall back to 1 when billed dollars are nonzero and no sender is named, and say "one person, by the bills". The throttle verdict (one biller or fewer) is unchanged.
2. **Badges are buttons inside buttons.** The stage and resource cards are `<button>`s and their badges are `role="button"` spans inside them (`BridgeStages.tsx`, `BridgeResources.tsx`). It works with the mouse and the keyboard, but nested interactive content is invalid markup and a screen reader will read the badge as part of the card. Move the badge out of the button (a sibling in the card's grid cell) or make the card a `div` with the name as the press.
3. **Dead parameter.** `buildDialReading` takes `fieldHoursPerWeek` and never reads it; the page computes the unit per stage itself. Remove it, or use it for Build's unit inside the kernel so the test covers it.
4. **`as never` casts in `calls.ts`.** The types were regenerated with `bridge_calls` on main the same day; the casts can go.

## Communications that lead astray

- **"bids invited"** on the Market card counts bids created in the window, drafts included. Say "bids opened" or count only bids that reached the GC.
- **The week card's jobs are earned, its head is contribution.** The three job lines sum to earned, not to the contribution the head shows. Caption the list "earned, by job".
- **"The day is profitable whenever the hours are read"** (the profit panel's break-even line) is asserted whenever the window's pace covers overhead, and the note blames approvals whenever hours wait and the day reads negative. A 14-day loss can also be materials bought ahead of the work. Soften the note to "part of this is hours waiting" and name the materials share.
- **Collect's badge "long · moves with Bill"** was the prototype's judgement; the app says "moves with Bill" for every stage downstream of the link, which is right, but the Collect card now reads 13.8 weeks with no hint that most of the pile is not yet late. Follows from calculation 3.
- **The Monday sheet's weakest-link tile** repeats the dial's three readings at today's pace under the heads "The pile / The link / The money"; in the mail they read without the dial beside them. Prefix each with the stage name.
- **"not readable yet"** survives on Market and Sales while their loaders are in flight, which is a few seconds of a wrong badge on every load. Show "reading…" while `demandInputs` is null and the error line only on failure.

## Suggestions

- **Friday on the schedule.** The scorecard asks on Friday, but the page is opened on Monday. Put the Friday ask on the schedule page's header for the dev, or send it in the Monday sheet's email on Friday too.
- **A bundle read.** The page now runs eleven loaders on open (the Bridge data, the finance hook, vectors, the weeks grid, the day grid, calls, build, demand, bank). Build's reports read carries `field_values` for every report since 90 days before the window. One RPC for the stage flow (open jobs, percent points, bids, estimates) would halve the wait and keep the percent parse in SQL, the way `list_latest_report_completion_pct` already does.
- **The held call and resources.** A call on Decision or Talent holds nothing on the stage cards (`heldLinkId` is a stage). When a resource is the call, hold the stage it throttles, so the red does not wander while the owner clears a pile.
- **The pay-week highlight.** The prototype's "Oct 4–10" chip that outlines everything scoped to the week was not built; the date and the week label in the header were. Build it only if the owner misses it.
- **Record a first call.** Nothing in `bridge_calls` yet. The first Monday is the test of the whole loop; the owner should press it rather than a session.

## The next train

| PR | What | Size |
|---|---|---|
| A | **Merged v2.5244.** Bill's in-rate on recorded time; Build shows both paces and feeds the larger; the thin-% gate and the "set the %s" badge; Talent's billers fallback. Collect's late pile moved to B. | S |
| B | Collect's weeks on the late pile with the current share grey; "bids opened"; the week card caption | S |
| C | The dial's dead parameter; the `as never` casts | S |
| D | Badges out of the buttons (markup), "reading…" while loaders fly | S |
| E | The scorecard's verdict on pile dollars too; the sheet's stage-named readings; the softened break-even note | S |
| F | The held call for a resource; Market compared on sold or win share | S |

## Where it stands

Written 2026-10-11 as the train merged. PR A merged the same day as v2.5244 (#5414): calculations 1, 2 and 7 and bug 1 are done, and Build reads 9–10 weeks on both paces. Collect is the link at 13.8 weeks on a pile that still counts current invoices. Next: PR B from main.

2026-10-24: calculation 5 closed by v2.5833 (the out-rate, #6122) and v2.5834 (the pile), found answering the owner's question whether the Bill card's 15 jobs were billed on GC portals and never recorded (they were recorded, as hand-marked bills). With both, Bill reads under a week and Collect holds the link alone at 10.2 weeks — calculation 3 (Collect's current invoices) is now the one that decides the red.
