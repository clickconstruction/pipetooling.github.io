import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2356',
  date: '2026-08-26',
  title: 'Sort the bid list on workflow tabs',
  kind: 'feature',
  highlights: [
    'The bid list on Counts, Takeoffs, Labor, Pricing, Cover Letter, RFI, Change Order, and Lien Release now opens sorted by bid number, highest first — no more random order.',
    'New views next to the search bar: Bid #, Due date (soonest first), Sent (most recent first), and Value (largest first).',
    'Your last-used view sticks across all eight tabs and across visits; search and "Only my bids" filter within it.',
  ],
}

export default note
