import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4536',
  date: '2026-10-05',
  title: 'GC statement emails: the paid-by line follows the new payment rule',
  kind: 'fix',
  highlights: [
    'The line under each bill in a scheduled GC statement email now uses the same rule as the rest of the app: money that paid work on no bill is not said to have paid a bill.',
    'Before, a bill could read as paid in full by an old check while the same row showed it still owed.',
  ],
}

export default note
