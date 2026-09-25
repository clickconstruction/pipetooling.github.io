import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3836',
  date: '2026-09-25',
  title: 'Checklist: “repeat N days after it’s done” lands on the right day',
  kind: 'fix',
  highlights: [
    'Checking off a repeating task on Checklist → Today, Review or the Dashboard inbox put its next occurrence one day early. For a task set to repeat 1 day after it is done, that was the same day — so the task quietly stopped repeating.',
    'All of those check-offs now use the same date math as the task’s activity panel: 3 days after means 3 days, and 1 day means tomorrow.',
  ],
}

export default note
