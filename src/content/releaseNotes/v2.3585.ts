import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3585',
  date: '2026-09-18',
  title: 'Payroll admin: clearing hours sets the days to 0',
  kind: 'fix',
  highlights: [
    'Clearing a person’s hours for a date range now sets each day to 0, the same way the Hours grid does, instead of deleting rows the database would not let go of.',
    'If any day in the range cannot be changed, the call fails with a message instead of reporting success.',
  ],
}

export default note
