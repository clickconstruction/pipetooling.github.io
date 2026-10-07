import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4798',
  date: '2026-10-07',
  title: 'GC mode: the schedule’s tables',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The GC mode schedule gets its tables in the database: the schedule itself, its bars and their parts, what each bar waits on, the dates to meet, failed inspections, baselines, and a line for each change to the plan.',
    'Only a dev can see them while they are built. Nothing reads or writes them yet.',
  ],
}

export default note
