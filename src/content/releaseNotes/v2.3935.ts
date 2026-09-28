import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3935',
  date: '2026-09-27',
  title: 'Schedule: the order of the Jobs tab has tests',
  kind: 'fix',
  highlights: [
    'The Jobs tab on the Schedule lists the busiest job first, then the highest job number. That order, and each job’s count of blocks per day, now come from one tested piece. The list reads the same as before.',
  ],
}

export default note
