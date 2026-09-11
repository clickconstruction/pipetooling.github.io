import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3341',
  date: '2026-09-11',
  title: 'Bid Costs: Cost to win',
  kind: 'feature',
  highlights: [
    'Bids → Bid Costs has a second lens, Cost to win: one row per estimator or per GC with bids, hours, spend, won / lost / open, won value, hit rate by value, and pursuit dollars per $1k won.',
    'By GC shows who you keep bidding for and who awards. Click any row to drop into the Pursuit ledger filtered to that person or GC.',
  ],
}

export default note
