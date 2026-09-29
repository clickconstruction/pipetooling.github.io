import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4074',
  date: '2026-09-28',
  title: 'Bids: the Bid window’s trade switch is its own piece',
  kind: 'fix',
  highlights: [
    'Copying a bid into another trade, and opening the same project’s bid in another trade, moved out of the Bids page into their own piece with tests. Nothing you see changed.',
  ],
}

export default note
