import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4540',
  date: '2026-10-05',
  title: 'Put a GC on notice: see the jobs that look wrong and jump to one',
  kind: 'feature',
  highlights: [
    'In the Put a GC on notice window, the count of jobs that look wrong is now a button. Point at it, or click it, to list those jobs.',
    'Each job in the list says what looks wrong and how much is still open.',
    'Click a job and the table scrolls to its row and lights it for a moment. If the table was hidden, it opens first.',
  ],
}

export default note
