import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4892',
  date: '2026-10-07',
  title: 'Bid room: two base bids are two options, never one added-up price',
  kind: 'fix',
  highlights: [
    'A letter with two base bids, like To Plans and Value Engineered, now gives the bid room Option 1 and Option 2. Each has its own price.',
    'Before, the room showed one Base bid at the two prices added together. A GC could have signed that sum.',
    'No room had been published that way yet, so there is nothing to send again.',
  ],
  roles: ['estimator', 'master_technician', 'assistant', 'dev'],
}

export default note
