import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4841',
  date: '2026-10-07',
  title: 'GC mode: the rules for the job’s records while we build',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules GC mode’s prototype worked out for a job being built now live in the app: the daily log, the punch list, submittals, questions to the architect, a trade’s draws and closeout, and the weekly report’s words.',
    'Nothing on screen changes yet. The first windows that use them come next.',
  ],
}

export default note
