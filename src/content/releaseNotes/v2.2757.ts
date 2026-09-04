import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2757',
  date: '2026-09-04',
  title: 'Needs you: the Team reviews due row is one line',
  kind: 'fix',
  highlights: [
    'The Team reviews due row on your Dashboard now reads just "No review from you in 30+ days." — the count sits beside it and the button opens the Rate deck, which already lists who is waiting.',
    'The names and the "rate them on Team → Review" instruction are gone, so the row no longer wraps to two lines.',
  ],
}

export default note
