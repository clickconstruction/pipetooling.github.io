import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4973',
  date: '2026-10-08',
  title: 'My Time day editor: Reject session uses only the one-step reject',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, Reject session in the time editor now uses only the one-step reject that takes the session’s hours out of payroll at the same time.',
    'The old two-step backup is gone. It was kept until the one-step reject went live, and it is live now.',
    'Nothing changes on screen.',
  ],
}

export default note
