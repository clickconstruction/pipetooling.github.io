import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2742',
  date: '2026-09-03',
  title: 'Add task: tapping outside no longer closes the dialog',
  kind: 'fix',
  highlights: [
    'The Add checklist item dialog stays open when you tap or click outside it, so a stray tap never throws away what you typed.',
    'A × button in the top corner closes it; Cancel and Send still work as before.',
  ],
}

export default note
