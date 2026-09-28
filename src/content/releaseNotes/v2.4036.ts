import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4036',
  date: '2026-09-28',
  title: 'Pricing: a second quote link goes to the right supply house',
  kind: 'fix',
  highlights: [
    'On the Supply house list, a second "Copy with quote link" on the same bid copied the first house\'s link again and saved no request — so the next supply house could be sent someone else\'s link. Each copy now makes a fresh link and request for the house you picked.',
  ],
}

export default note
