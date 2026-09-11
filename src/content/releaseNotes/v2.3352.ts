import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3352',
  date: '2026-09-11',
  title: 'Bid Costs: the rail says what it sums',
  kind: 'fix',
  highlights: [
    'The Bid Costs rail headings now read "Spent bidding by estimator · last 12 months" (or last 90 days / all time) instead of "By estimator · year", and the same words sit on the outcome block, the first tile, and Cost to win\'s Everyone row.',
    'The Search bids box stretches to fill whatever room is left on its line.',
  ],
}

export default note
