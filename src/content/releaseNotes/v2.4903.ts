import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4903',
  date: '2026-10-07',
  title: 'Labor: each set-aside row is kept once',
  kind: 'fix',
  highlights: [
    'Switching a bid to another version could list the same row several times in Hours not on the counts. Each row now shows once.',
    'The copies on the one test bid where this happened are cleared. No real bid was touched, and no total changed.',
  ],
  roles: ['estimator', 'master_technician', 'assistant', 'dev'],
}

export default note
