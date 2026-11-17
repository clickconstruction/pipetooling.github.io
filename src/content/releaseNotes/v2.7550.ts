import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7550',
  date: '2026-11-16',
  title: 'Checklist: mark a round of daily tasks done in one press',
  kind: 'feature',
  highlights: [
    'When two or more of today\'s repeating tasks are open, a press under them reads "Mark 3 done", with its count.',
    'A window asks once before anything is marked. Each task then finishes as if you had ticked it.',
    'A one-time task, a task with lines to tick and a task that asks for a photo are left out, and a line says how many.',
  ],
}

export default note
