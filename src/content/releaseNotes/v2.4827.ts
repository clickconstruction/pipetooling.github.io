import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4827',
  date: '2026-10-07',
  title: 'GC mode: the tables for the job’s records while we build',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'GC mode gets tables for what happens on a job we are building: the daily log with who was on site and what held work up, the punch list, the submittal register, questions to the architect, and the weekly report to the customer as it went.',
    'Only a dev can see them while they are built. Nothing reads or writes them yet.',
  ],
}

export default note
