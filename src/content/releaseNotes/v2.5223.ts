import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5223',
  date: '2026-10-10',
  title: 'Hours approvals: approve the sessions the dispatch schedule already vouches for',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller', 'assistant'],
  highlights: [
    'A pending session reads on the schedule when dispatch had that person on that job that day and the day\u2019s hours land within an hour of the schedule.',
    'Approve the N on the schedule, at the top of the queue, takes those rows in one press and leaves you the exceptions.',
    'A scheduled day that clocked more than an hour off reads off the schedule, so it is yours to read first.',
  ],
}

export default note
