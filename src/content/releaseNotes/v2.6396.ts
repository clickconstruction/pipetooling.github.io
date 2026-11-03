import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6396',
  date: '2026-11-02',
  title: 'A digital twin can no longer read the words inside the job files',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Our own file index holds the words inside every job’s files. A digital twin counts as an estimator, so it could read them, though Drive has always refused a twin. The index now refuses a twin too.',
    'People read the index exactly as before: the office and the estimators find their files, and nobody else sees them.',
  ],
}

export default note
