import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3171',
  date: '2026-09-08',
  title: 'The Bid Board no longer scrolls sideways on a phone',
  kind: 'fix',
  highlights: [
    'On phone screens the Bid Board page could be dragged sideways, with the right edge of every bid card and the due chips hanging off the screen. The page now stays put.',
    'Each bid card\'s top row — the jump icons, bid number, and gear — keeps its place, and the due-date chip drops to its own line on the right when the two don\'t fit side by side.',
  ],
}

export default note
