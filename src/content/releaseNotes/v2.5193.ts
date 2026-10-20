import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5193',
  date: '2026-10-10',
  title: 'GC mode: bring in a schedule someone handed us',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev can start a GC job’s schedule from the customer’s or the architect’s own schedule file.',
    'Each of their activities shows where it goes and why, before anything is written. The file is never kept.',
    'On a job being built, a dev can take only their dates to meet from a file. Nothing else moves.',
  ],
}

export default note
