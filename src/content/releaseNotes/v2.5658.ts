import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5658',
  date: '2026-10-20',
  title: 'A customer’s record no longer tells an estimator they owe nothing',
  kind: 'fix',
  roles: ['estimator', 'dev'],
  highlights: [
    'Their record, opened from the money line under a won bid, showed an estimator “Open balance $0” and “None yet” for jobs, even with money open. It now says the bills and jobs are the office’s, and points back to the money line.',
    'The office and primaries see the record as before.',
  ],
}

export default note
