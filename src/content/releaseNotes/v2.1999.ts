import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1999',
  date: '2026-08-21',
  title: 'Tap "N unstaffed" to see exactly what needs names',
  kind: 'feature',
  highlights: [
    'The Plan header\'s "N assigned" and "N unstaffed" counts are now tappable: the Plan narrows to just those tasks under an amber "limited view" banner with a one-tap ✕ Show everything exit.',
    'The unstaffed lens doubles as a staffing worklist — Staff this stage stays on every card, rows leave the lens as they gain names, and emptying it closes the lens.',
  ],
}

export default note
