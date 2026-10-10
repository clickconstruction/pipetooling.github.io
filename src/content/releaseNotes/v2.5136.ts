import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5136',
  date: '2026-10-09',
  title: 'SQL beds keep each run’s errors in a file of their own',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The database test beds write each run’s errors to a new file, removed when the run ends.',
    'A bed no longer fails on a shared Mac because another person ran it first.',
    'Nothing in the app changes.',
  ],
}

export default note
