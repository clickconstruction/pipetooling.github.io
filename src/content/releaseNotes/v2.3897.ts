import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3897',
  date: '2026-09-27',
  title: 'Controller access, batch 2: bids, the books and estimates',
  kind: 'fix',
  highlights: [
    'A controller can now see and work Bids and Estimates: every bid, its counts and pricing, the price, labor and takeoff books, and estimates. Before, those pages came up empty for a controller login.',
    'This is the second of five updates that give the controller role everything the assistant role already has.',
  ],
}

export default note
