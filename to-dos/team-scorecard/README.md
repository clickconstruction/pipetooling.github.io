---
name: "Team scorecard: two numbers, one formula each, against the hurdle"
number: 360
group: ready
status: design spike 2026-11-15, four passes on live data · PR 1 (v2.7325) the Scores tab with the field score, the estimator score, the hurdle and the ramp · PR 2 (v2.7347) a priced bid says when it cannot be scored on the workbench, its share window, Mark sent and the Bid Board, and 16 old awards got a day · next PR 3, the target on the Bid Board's Pricing rules
next: >
  PR 3: the target on the Bid Board's Pricing rules beside the difficulty price list, with the
  owner's own UPDATE policy on scorecard_hurdle_v1, and the Scores tab links there. The owner's
  four calls under Calls the owner makes are unanswered and block none of the train.
size: M as a train of five (M · S · S · M · S); PRs 1 and 2 shipped
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

## What the live data said (2026-11-15, 56-day window)

- Field: $47/h on 1,817 paid hours, against a $37/h hurdle ($12/h break-even + $25/h target). 81 jobs; 9 have hours and no bill, all real unbilled work (a lift-station site visit at 139 hours, a concrete cut and pour, a line repair, a walkthrough, five small ones).
- Estimating: *0 of 20*. No bid ever awarded carries a priced stamp (the stamp is newer than every award). Every one of the 25 stamped bids reads labor unusable (hours on 0–9 of its rows) and 24 have uncosted rows, so the priced cost has no labor in it. The 12 finished bid-linked jobs have neither a stamp nor award hours, so history cannot be backfilled. 100 proposals are out past 120 days with no answer; `bids.outcome_at` is empty on every won bid older than 2026-09-11; 8 jobs have an award snapshot.
- None of the window's 60 clocked jobs has a project on record, so the superintendent cut reads one line until projects get superintendents; every job's master is the same person.

## Calls the owner makes

1. **Earned, not invoiced.** The field score earns by hours (contract × the window's share of expected hours), as the app does everywhere. The prompt said invoiced.
2. **Burden on actuals.** Bids price labor at the average wage × 1.20, but the job's burn, the Costs tab and the team-labor reads price clocked hours at raw wages; only the superintendent scoreboard applies the factor. The scorecard applies it. Whether the Costs tab and the burn should too is a separate card.
3. **Where the target lives.** On the tab for a dev now; the shipped home is the Bid Board's Pricing rules beside the difficulty price list, once the GC difficulty train's PR 4 lands.
4. **Hours reasons.** The field score needs none. If the owner wants the drive / shop / waiting / callback drill-down, drive and shop can be inferred (travel stamps, the office job); only waiting and callback would need a press from the tech.

## The train

1. ~~**The Scores tab**~~ v2.7325.
2. ~~**The estimating desk's feedback**~~ v2.7347: the Pricing workbench, its share window and the Cover Letter's Mark sent say when the bid cannot be scored, the Bid Board row carries the chip, and 16 old awards got `bids.outcome_at` from their linked job's creation. Left for PR 4: a sent bid's margin is frozen without its labor count, so hours filled after the send make it read as judged.
3. **The target on the Bid Board's Pricing rules**, with the owner's own UPDATE policy on `scorecard_hurdle_v1` (one migration); the tab links there.
4. **`team_scores(p_from, p_to)`**, a SECURITY DEFINER function with the loader's arithmetic, as `superintendent_scores` does, so the gate can widen without a wage leaving the database; the tab reads it instead of the browser-side loader.
5. **The estimator's own row on the phone**, and a closeout's adjustment named on the bid.

Separate card, the owner's call: job actuals at the burden factor on the Costs tab and the burn.
