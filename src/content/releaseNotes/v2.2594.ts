import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2594',
  date: '2026-09-01',
  title: 'Robot Queue: backtest candidates',
  kind: 'feature',
  highlights: [
    'The dev Queue lens now lists which decided bids are graded well enough to be robot practice runs, grouped by the confidence axis that needs them most.',
    'An axis with no usable references says so — and counts the flagged ones, so you know when the fix is repairing history rather than running it.',
    'Each candidate row copies a blind backtest kickoff prompt; unclassified rows get an assign-axis picker.',
  ],
}

export default note
