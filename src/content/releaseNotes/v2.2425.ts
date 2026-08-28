import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2425',
  date: '2026-08-28',
  title: 'Sent dates stop wrapping mid-date',
  kind: 'fix',
  highlights: [
    'In the Cover Letter checklist, "★ WENDI · $56,343.00 · sent 8/27" no longer breaks between "sent" and the date at narrow widths — each piece wraps as a unit, only at the separators.',
    'The Send to strip\'s "sent 7/7 · $X" chip lines get the same treatment.',
  ],
}

export default note
