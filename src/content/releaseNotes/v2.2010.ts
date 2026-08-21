import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2010',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Checklist Manage: tap a card for its history and notes',
  highlights: [
    'On Checklist → Manage, tapping any task card expands its full activity — who created it, every completion, reopen, and sign-off, and all notes, with who and when.',
    'Add a note right from the expanded card; it lands on the task’s current occurrence and shows up everywhere the task’s activity appears.',
    'Repeating tasks show which day each event belonged to when it isn’t obvious from the timestamp.',
  ],
}

export default note
