import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4001',
  date: '2026-09-28',
  title: 'Schedule: the People grid’s cells and cards are their own piece',
  kind: 'fix',
  highlights: [
    'Each cell of the Schedule’s People grid, and the block cards inside it, now live in their own file, with automated checks on what a cell offers and what a card’s buttons do. They look and work the same as before.',
  ],
}

export default note
