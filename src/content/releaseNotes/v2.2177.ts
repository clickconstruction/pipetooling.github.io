import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2177',
  date: '2026-08-23',
  kind: 'feature',
  title: 'Primaries see only the jobs they manage',
  highlights: [
    'A primary now sees only the jobs they are the Account Man for — on Documents, in Edit Job, and anywhere a job list appears. The Reports tab keeps working exactly as before.',
    'Nothing changes for other roles. (Applies once the migration is pushed.)',
  ],
}

export default note
