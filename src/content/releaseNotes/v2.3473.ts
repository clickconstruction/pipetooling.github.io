import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3473',
  date: '2026-09-15',
  title: 'The supply house invoice form scrolls and fits on one screen',
  kind: 'fix',
  highlights: [
    'Materials → Supply Houses → Add / Edit Invoice: on a short screen the form clipped top and bottom with no way to scroll, so Save and the Link field were out of reach — the panel now scrolls, and the title bar with its × stays pinned while you fill it in.',
    'Purchase Order #, Invoice Date and Amount share one row, and Due Date sits beside Link — the whole form fits a laptop screen without scrolling at all. On a phone the fields stack as before.',
  ],
}

export default note
