import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2055',
  date: '2026-08-22',
  kind: 'fix',
  title: 'Checklist scheduling: groundwork fixes',
  highlights: [
    'Fixed a date bug where a weekly task could create its first occurrence the day before its chosen start date.',
    'A task can now only ever have one occurrence per day — enforced at the database level, so double-created occurrences are impossible.',
    'First step of the checklist scheduling overhaul; the visible improvements land in the next releases.',
  ],
}

export default note
