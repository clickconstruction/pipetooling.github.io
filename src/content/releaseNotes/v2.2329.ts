import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2329',
  date: '2026-08-26',
  title: 'One-click invoice PDF from the board',
  kind: 'feature',
  highlights: [
    'View Bill buttons on Jobs → Pipeline billed rows now carry a small PDF tail — one click opens the invoice PDF in a new tab, freshly generated with the current payment history.',
    'Same paper as the View Bill window’s "Open PDF in new tab", without the trip through the window.',
  ],
}

export default note
