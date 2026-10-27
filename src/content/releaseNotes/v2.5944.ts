import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5944',
  date: '2026-10-26',
  title: 'An evening call counts as today, not tomorrow',
  kind: 'fix',
  highlights: [
    'A lean or a call logged after 7 PM Central read as "leaned on -1d ago" on Quickfill\'s Billed Awaiting Payment station, and the customer\'s last call showed tomorrow\'s date.',
    'Both now read the day on the company\'s calendar, so an evening call is today\'s, and a snooze set that evening ends on the day it should.',
  ],
}

export default note
