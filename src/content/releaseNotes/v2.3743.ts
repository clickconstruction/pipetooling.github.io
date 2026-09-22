import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3743',
  date: '2026-09-22',
  title: 'Day book: the snapshot records each count the moment it resolves',
  kind: 'fix',
  highlights: [
    'The Dashboard’s once-a-day snapshot for the Day book marked the day done at the first count it saw, so a count that resolved a moment later (deposits, after contracts) was never recorded. Each kind is now recorded the day it resolves.',
  ],
}

export default note
