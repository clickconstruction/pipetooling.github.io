import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4102',
  date: '2026-09-28',
  title: 'Bids: the Bid window’s saving and closing are their own piece',
  kind: 'fix',
  highlights: [
    'Groundwork inside the Bids page: opening a bid, its autosave, Create bid, closing and delete now live in one piece of their own, with tests of what each one writes. Nothing you see changed.',
  ],
}

export default note
