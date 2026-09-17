import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3572',
  date: '2026-09-17',
  title: 'Price requests: the row says waiting, late or quote in, takes the quote link right there, and calls the rep',
  kind: 'feature',
  highlights: [
    'On Edit Bid → Price requests, every row carries a Status chip — waiting, late with the days, or quote in — and the header count says how many are late.',
    'A hand-sent request that is still waiting has a paste box on the row: drop the quote link in and press Enter. The Quote column holds only the quote; whether it went by app or by hand sits beside the date.',
    'Hand-sent rows gain Call when the house\'s default rep has a phone on the Directory; app rows keep Nudge.',
  ],
}

export default note
