import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4058',
  date: '2026-09-28',
  title: 'Bids → Pricing: the price cards read from their own pieces',
  kind: 'fix',
  highlights: [
    'The price cards on the Pricing tab — each price\'s total, each alternate version\'s numbers, and which GC each one goes to — now load through their own tested pieces of the app. Nothing on screen changed.',
  ],
}

export default note
