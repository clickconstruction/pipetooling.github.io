import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7140',
  date: '2026-11-13',
  title: 'Pay calendar: the last screens read the due day',
  kind: 'feature',
  highlights: [
    'Quickfill’s Billed Awaiting Payment no longer calls a pay calendar customer past due 30 days after the bill. They are past due the day after their due day.',
    'A development’s Money look reads Due with the contract’s day for their billed jobs, and counts a job past due only after it.',
    'A homeowner’s Paid step is due on the pay calendar’s day when whoever pays that bill is on one.',
    'A customer with no pay calendar reads exactly as before.',
  ],
}

export default note
