import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2060',
  date: '2026-08-21',
  title: 'Workbench: price from the book',
  kind: 'feature',
  highlights: [
    'The Pricing Workbench gains a Book entry column — every row shows its assigned entry (name · book price) or an "assign…" search that types, picks, and prices without leaving the sheet.',
    '"Fill N matching from book" assigns every exact-name match in one click — and counts them in the button before you press it.',
    'The header names the book and its entry count, and unassigning restores whatever price the row had before.',
  ],
}

export default note
