/**
 * The labor burden factor, in words (Taunya, 2026-11-27).
 *
 * `app_settings.labor_burden_factor_v1` multiplies a recorded field wage, 1.20 since the migration that seeded it.
 * No screen set it and none said what it was: the only words were a code comment that read *taxes, insurance, the
 * truck*. Asked whether 1.20 stays, Taunya said to leave it and that the setting should be well defined about where
 * it reaches, and that it is meant to stand for depreciation on the tools and the truck a person uses. So that is
 * its meaning from 2026-11-27, and this file is what the Settings block for a developer says.
 *
 * Every line under *Where it reaches* and *Where it does not* was checked against the code on that day. A line is
 * added here only with the read that confirms it:
 *
 *  - bids: `src/lib/bids/crewRate.ts`, the company crew rate, read by the Labor tab and by Pricing;
 *  - a job's labor budget: `JobBudgetCard.tsx` prices typed hours at that company rate;
 *  - the superintendent scoreboard: the database's `superintendent_scores` reads the factor;
 *  - the team scores, field: `src/lib/scorecard/fieldScore.ts` multiplies the hours' wages by it;
 *  - the team scores, estimator: `src/lib/scorecard/scorecardReads.ts` takes team labor at it off a finished job.
 *
 * It does not reach a job's burn, the Job Summary, Crew P&L, the pay stubs, the overhead pool or the job day ledger:
 * none of their kernels reads the factor or the company rate.
 *
 * The comment over the key in `appSettingsKeys.ts` still reads *taxes, insurance, the truck*. That file is copied to
 * the edge functions (`supabase/functions/_shared/gcKernels`), so one changed word there would leave every function
 * that bundles it reading as behind. The meaning is kept here, in a file no edge function copies.
 *
 * The block changes nothing. The number is the database's, and changing it is a developer's write. Pure.
 */

/** The block's name, with the mark every developer-only block of the tab carries. */
export const LABOR_BURDEN_TITLE = 'Labor burden factor (dev)'

/** The factor as the screens write it: *×1.20*. */
export function laborBurdenFigure(factor: number): string {
  return `×${factor.toFixed(2)}`
}

/** What the factor does to one wage, worked out from the factor itself: *$30.00 an hour counts as $36.00*. */
export function laborBurdenExample(factor: number, wage = 30): string {
  return `A wage of $${wage.toFixed(2)} an hour counts as $${(wage * factor).toFixed(2)} an hour.`
}

export const LABOR_BURDEN_WORDS = {
  /** What it is. */
  what: 'The app multiplies a field wage by this number wherever it prices a crew hour.',
  /** What it stands for, in Taunya's words of 2026-11-27. */
  standsFor: 'It stands for depreciation on the tools and the truck a person uses.',
  /** What it is not, so nobody reads it as the whole load on a wage. */
  notOverhead: 'It is not the office’s overhead. The overhead pool is counted by itself.',
  reachesHead: 'Where it reaches',
  reaches: [
    'A bid’s crew rate. The company rate on a bid’s Labor tab is the last 90 days of field wages times this number.',
    'A bid’s price. Pricing uses that company rate when the bid has no rate of its own.',
    'A job’s labor budget. The Job Budget card prices its hours at the company rate.',
    'The superintendents’ scoreboard. The team’s clock hours are costed at this number.',
    'Team scores, the field score. The hours’ wages are multiplied by it.',
    'Team scores, the estimator’s score. A finished job’s team labor is taken off at it.',
  ],
  notHead: 'Where it does not',
  not: [
    'What a job has cost so far. A job’s burn reads wages as paid.',
    'Job Summary’s Labor column.',
    'Crew P&L.',
    'Pay stubs. Nobody’s pay changes with it.',
    'The overhead pool.',
  ],
  /** How it changes: not from here. */
  change: 'No press here changes it. A developer changes the number in the database.',
  reading: 'Reading the factor…',
  readFailed: 'The factor did not read.',
} as const

/** Every sentence the block can say, for the plain-words test. */
export function laborBurdenSentences(factor: number): string[] {
  const W = LABOR_BURDEN_WORDS
  return [W.what, W.standsFor, laborBurdenExample(factor), W.notOverhead, ...W.reaches, ...W.not, W.change, W.reading, W.readFailed]
}
