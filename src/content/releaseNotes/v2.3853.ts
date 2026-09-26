import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3853',
  date: '2026-09-26',
  title: 'Bids → Pricing: one place prices a scenario',
  kind: 'fix',
  highlights: [
    'The math that turns a price scenario’s assignments and custom prices into priced rows was written by hand in six places across the Pricing tab; two of them shipped rows at $0.00 when an alternate priced against another version’s counts. It is now one tested piece of code that every path reads: the grid, Share / print / CSV, the price cards, the alternates, and Copy prices from.',
    'Nothing on screen changes; every number reads as before.',
  ],
}

export default note
