import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2278',
  date: '2026-08-25',
  title: 'Goals bar fits phones again',
  kind: 'fix',
  highlights: [
    'The Goals stage bar on Checklist → Review wraps onto extra rows on phones instead of running off the screen — every stage visible and numbered again.',
    'Rows scheduled today show “2h ago” instead of a raw date, and the sign-off fold is back to its short “Review: completed work” title.',
  ],
}

export default note
