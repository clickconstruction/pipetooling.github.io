import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6928',
  date: '2026-11-11',
  title: 'An open price sheet reads itself once',
  kind: 'fix',
  highlights: [
    'A price sheet open beside Takeoffs read itself from the server again and again, many times a second. It now reads once when it opens, and again only after you change something.',
    'Picking the sheet\'s supply house no longer fails with a no connection message.',
  ],
}

export default note
