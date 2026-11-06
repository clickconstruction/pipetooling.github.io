import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6583',
  date: '2026-11-06',
  title: 'An as-built stays on the job that made it',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'subcontractor', 'helpers'],
  highlights: [
    'A crew member who added an as-built can still change or remove it, but can no longer point it at another job or another part they are not on. The database refuses the move the way it refuses a new as-built on a job they are not on.',
    'The office changes and moves any set as before.',
  ],
}

export default note
