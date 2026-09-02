import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2631',
  date: '2026-09-01',
  title: 'Supply house quotes: send a link, prices type themselves in',
  kind: 'feature',
  highlights: [
    'The Supply house list screen grows "Copy with quote link": pick the house, and the copied text ends with a link the vendor opens on their phone.',
    'The vendor types prices right into that page — big thumb-size inputs, "can\'t supply" a tap away, and their entries save on their phone as they go. No login, no app.',
    'When they hit Send, the quote lands on your bid ready to compare — the Quotes chip turns green, and an "RFQ sent" chip shows while you\'re still waiting.',
    'Links on a lost bid close themselves, so a stale text can\'t collect prices for a job that\'s gone.',
  ],
}

export default note
