import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5181',
  date: '2026-10-10',
  title: 'GC mode: who to call on each row of the Project Board',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Each row of the Project Board now says how many people we wait on for that job, and how many are late.',
    'Point at the count to see each person with every reason we need them, the late ones first, and Call beside each.',
    'Open Follow up takes you to everyone we wait on across all jobs.',
  ],
}

export default note
