import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3772',
  date: '2026-09-23',
  title: 'Pipeline strip menus: the page scrolls while a menu is open',
  kind: 'fix',
  highlights: [
    'On the Jobs Pipeline strip, opening the ☰ section-tools menu or the ⋯ tools menu used to freeze the page behind it. On a short screen the bottom of the ☰ list — Lien desk, Paid in Full — sat below the fold with no way to scroll to it.',
    'Now the page scrolls as usual while either menu is open, so every row is reachable. A tap or click anywhere outside the menu still closes it, and so does the Escape key.',
  ],
}

export default note
