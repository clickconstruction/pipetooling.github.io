---
name: "Team scorecard: two numbers, one formula each, against the hurdle"
number: 360
group: close
status: design spike 2026-11-15, four passes on live data · PR 1 (v2.7325) the Scores tab with the field score, the estimator score, the hurdle and the ramp · PR 2 (v2.7347) a priced bid says when it cannot be scored on the workbench, its share window, Mark sent and the Bid Board, and 16 old awards got a day · PR 3 (v2.7361) the owner sets the target on the Bid Board's Pricing rules · PR 4 (v2.7365) the scores are read by the edge function `team-scores`, Taunya's pick · PR 5 (v2.7369) the estimator's own row on the Bid Board and a closeout's chip on the bid · the residual (v2.7370) a sent bid is judged by the labor count kept with its margin · the train is built, every PR merged, pushed, deployed and walked live 2026-11-15 · the viewport walk's fixes in v2.7397
next: >
  An estimator reads their row. Then this card is retired.
  Nothing is left to build on this card. The Scores tab was read on the live site on 2026-11-27 at 1280 px (the walking thread's sitting 34, v2.8691) and is clean. Calls 1, 2 and 3 were answered by Taunya that day and each stays as built. Call 4 was answered the same day, *Picks stand* to *No breakdown*, so no call is open.
size: M as a train of five (M · S · S · M · S); all five shipped
blocker: none; the estimators' number stays a ramp until a priced bid with labor hours is awarded
summary: >
  A prompt from outside the company proposed four team scores for a plumbing shop. The owner
  liked the idea of measuring the team on numbers a decision moves and asked for the parts
  worth keeping. Kept: one frozen formula per number, gross profit on every paid field hour
  against a hurdle, the estimator's number corrected to the actual when the job closes, no
  vanity cards, and a flag on hours with no bill. Left out: a dispatch score (no service board,
  no reasons on a clock session), a burden split into tax, comp and benefits (one factor is
  enough), last year's overhead as a constant (the rolling pool is better), and a second
  backlog number (Ahead and the Bridge's flow strip already carry it). PR 1 ships the tab;
  the train below makes the estimators' number real.
---

# Team scorecard: two numbers, one formula each (punch list #360)

## What PR 1 shipped (v2.7325)

People → Review → **Scores** (`/people?tab=scores`), the scoreboard's gate (dev, the owner, payroll access), a window of 4 weeks, 8 weeks or 90 days.

- **Field** (the crew): gross profit ÷ paid field hours over the window, against the hurdle. Gross profit is what the window's hours earned of their jobs' contracts less those hours' wages at the burden factor, the materials and the subs dated in the window. Every paid field hour on a job counts. Drill-down: one row per job, a job with hours and no bill flagged with a door to the job, and the score cut by who runs the jobs (the scoreboard's mapping).
- **Hurdle**: the window's overhead pool ÷ its paid field hours (break-even) plus the owner's target profit per hour (`app_settings.scorecard_hurdle_v1`), set on the tab by a dev.
- **Estimating & sales** (one shared number): a bid counts its priced gross profit at award when that profit over the award's labor hours clears the hurdle; under the hurdle it counts zero and stays there; once the job is billed or paid the actual replaces the estimate, dated by the first Billed move. The period's number is a flow: additions at award plus the closeouts' adjustments. Drill-down: awarded, closed, counting zero with the reason, proposals out with their days; *Finish these before they can score* lists the priced bids whose Labor tab needs hours, each with a door.
- **The ramp**: until the first judged bid is awarded, the estimating card reads *N of M* priced bids that can be judged. It retires itself with the first judged award.

Kernels: `src/lib/scorecard/hurdle.ts`, `fieldScore.ts`, `estimatorScore.ts`. Loader `loadScorecard.ts` reuses the job day ledger, `loadEarnedJobs`, the Bridge's materials and sub reads and the Costs tab's loader. Fragment `docs/recent-features/v2.7325.md`; guide `read-the-team-scores`.

## Checked live

- **PR 2 (v2.7347), 2026-11-15**, on clicktooling.com as the dev, after the merge (#8211) and the push. The migration's notice read 16 awarded bids given an award day; prod then read 47 awarded bids, 25 still with no day (none of them has a job), none dated before its send. The types followed in #8226. The Bid Board drew 26 *Can't be scored* chips: 20 on sent bids as words, 6 on unsent bids as presses (5 for labor, 1 for rows with no cost). The press on the test bid BP605 opened its Labor tab. Its Workbench read *Can't be scored. $21,000 of the price is on rows with no cost, so the margin is partial and this bid cannot be scored. Give every priced row a cost before it goes out.* with **Open Labor** under the priced-margin line. The same line stood at the top of *Share with a teammate* and under **Mark sent today** on the Cover Letter. Nothing was sent or saved.
- **PR 3 (v2.7361), 2026-11-15**, as the dev, after the merge (#8255), the push and the deploy. `app_settings` carries the owner's insert and update policies on `scorecard_hurdle_v1`, each held to `is_master_or_dev()`. `/bids?tab=bid-board&rules=1` opened Pricing rules by itself and dropped the flag; **The score's target** drew under the price list with **Save the target** dead, letters left it dead and a different number woke it. Nothing was saved: prod has no row for the target yet, so the figure shown is the default and the first real save is Micah's. **Open the Scores tab** went to People → Scores, where the old form is gone and **Open Pricing rules** leads back to the same door.
- **PR 4 (v2.7365), 2026-11-15**, as the dev, after the merge (#8263), the push and the first deploy of `team-scores`. `list_people_pay_flags` and `get_invoice_amounts_for_jobs` carry the service-role branch. People → Scores drew both cards from one call that answered 200 in 3.3 s, under *Read on the server.*; the answer's field names hold no wage. On a dev page the function's answer and the browser loader's read were compared value by value for 28, 56 and 90 days: 1,406, 1,931 and 2,881 values and not one differs. **Found:** the fallback never ran, because a browser is refused the gateway's 404 (no CORS headers) and sees a failed request; for four minutes, 01:28 to 01:32 UTC, the tab read *The scores could not be read.* until the deploy. Fixed in v2.7370. A function a client calls is deployed right after the merge, before the Pages deploy finishes.
- **PR 5 (v2.7369), 2026-11-15**, after the merge (#8275) and the redeploy of `team-scores` a minute later, ahead of the client. As the dev `bids` and `mine` each answered 200 with the estimating score alone; as the sample estimator all three views were refused (a sample account is not a real account). The Bid Board made one call; no *Closed* chip drew and none should, since no judged bid's job has closed in 8 weeks. As a real estimator through the dev's View as, read only: **Your score** drew over the board, *0 of 8 of your priced bids can be scored*, its sheet gave the hurdle as one figure with nothing about overhead, and **Open Labor** went to the bid's Labor tab. Not walked: an assistant's or a controller's row, and a row with a won bid in it.
- **The residual (v2.7370), 2026-11-15**, after the merge (#8285), the push and the redeploy. The two columns are on `bids`, the stamp has one definition with its seven arguments and writes the count, the types followed in #8294. Called as the dev with the test bid's own kept numbers, the stamp left the money alone and wrote 3 labor rows, 3 with hours. The migration was renumbered to `20261116130000` before its PR, a sibling's `20261116100000` having reached prod first.
- **Every width (v2.7397), 2026-11-15**, on Taunya's ask: the Scores tab, the Bid Board's chips, the *Can't be scored* line and Pricing rules' target at 375, 768, 1024, 1280 and 1600 px in light and dark. No sideways scroll, nothing clipped. Fixed: *Open Pricing rules* and *Open Labor* were 15 to 36 px tall on a phone. Seen and left, in the fragment: the window presses at 28 px, and the muted lead at 4.3 to 1 on the page's grey ground in light.

## What the live data said (2026-11-15, 56-day window)

- Field: $47/h on 1,817 paid hours, against a $37/h hurdle ($12/h break-even + $25/h target). 81 jobs; 9 have hours and no bill, all real unbilled work (a lift-station site visit at 139 hours, a concrete cut and pour, a line repair, a walkthrough, five small ones).
- Estimating: *0 of 20*. No bid ever awarded carries a priced stamp (the stamp is newer than every award). Every one of the 25 stamped bids reads labor unusable (hours on 0–9 of its rows) and 24 have uncosted rows, so the priced cost has no labor in it. The 12 finished bid-linked jobs have neither a stamp nor award hours, so history cannot be backfilled. 100 proposals are out past 120 days with no answer; `bids.outcome_at` is empty on every won bid older than 2026-09-11; 8 jobs have an award snapshot.
- None of the window's 60 clocked jobs has a project on record, so the superintendent cut reads one line until projects get superintendents; every job's master is the same person.

## Calls the owner makes

1. **Earned, not invoiced.** The field score earns by hours (contract × the window's share of expected hours), as the app does everywhere. The prompt said invoiced.
   **Answered 2026-11-27 by Taunya**, asked with an example of a job part worked in a month, how the score should count what a crew earned in a window: *By hours worked*. It stays earned by hours, as built.
2. **Burden on actuals.** Bids price labor at the average wage × 1.20, but the job's burn, the Costs tab and the team-labor reads price clocked hours at raw wages; only the superintendent scoreboard applies the factor. The scorecard applies it. Whether the Costs tab and the burn should too is a separate card.
   **Answered 2026-11-27 by Taunya**, after a read of where the burden is applied and that it does not overlap the overhead pool's office labor: *for the 1.2, leave it*. The burden stays on the scorecard. The same day she said the job's burn should be priced at the burden too, *Yes, burn at the burden*, which is card #448 (`to-dos/burn-labor-at-the-burden.md`); the Costs tab keeps showing the wages paid.
3. **Where the target lives.** On the Bid Board's Pricing rules beside the difficulty price list since v2.7361, set by the owner. Whether that is the home he wants is still his call.
   **Answered 2026-11-27 by Taunya:** *ok*. The target stays on the Bid Board's Pricing rules.
4. **Hours reasons.** The field score needs none. If the owner wants the drive / shop / waiting / callback drill-down, drive and shop can be inferred (travel stamps, the office job); only waiting and callback would need a press from the tech.
   **Answered 2026-11-27** by the person at the keyboard, *Picks stand* to the pick *No breakdown*, relayed by the managing session. The row as read: *hours broken down by reason: no breakdown. Nothing changes.* The field score keeps no hours reasons.

## The train

1. ~~**The Scores tab**~~ v2.7325.
2. ~~**The estimating desk's feedback**~~ v2.7347: the Pricing workbench, its share window and the Cover Letter's Mark sent say when the bid cannot be scored, the Bid Board row carries the chip, and 16 old awards got `bids.outcome_at` from their linked job's creation. Left for PR 4: a sent bid's margin is frozen without its labor count, so hours filled after the send make it read as judged.
3. ~~**The target on the Bid Board's Pricing rules**~~ v2.7361: **The score's target** under the difficulty price list, the owner's own insert and update policies on `scorecard_hurdle_v1`, and the tab's door (`/bids?tab=bid-board&rules=1`).
4. ~~**`team_scores`**~~ v2.7365, as an edge function and not the SQL function first planned. The loader's arithmetic is the Overhead page's pool and the Costs tab's charge events, and `overheadPoolSnapshotReads.ts` says why none of it is in SQL: *no SQL re-implementation, no second kernel to drift*. Taunya picked the edge function on 2026-11-15 over a SQL function for the wage-priced hours alone and over leaving the read in the browser. `team-scores` runs the app's own `readScorecard` as the service role and answers with hours and dollars by job; seven reads now take a client; two database functions answer the service role. The tab falls back to the browser's read only while the function is not deployed.
5. ~~**The estimator's own row on the phone**, and a closeout's adjustment named on the bid~~ v2.7369: **Your score** at the top of the Bid Board for an estimator, an assistant or a controller with a bid in the last 8 weeks, with its sheet; *Closed +$N* on a won bid whose job was billed; `team-scores` answers `mine` (a person's own bids, the hurdle as one figure) and `bids` (the gate, for the chips); and a closeout now counts whatever its award day. The one residual shipped as v2.7370: the stamp keeps the count of the bid's labor rows and of those with hours, and a sent bid is judged by that count, so hours filled in after a send no longer make it read as judged.

Separate card, the owner's call: job actuals at the burden factor on the Costs tab and the burn.
