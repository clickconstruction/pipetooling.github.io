import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4633',
  date: '2026-10-06',
  title: 'Lien timeline: a date never breaks across two lines',
  kind: 'fix',
  highlights: [
    'On the lien timeline and the months list, a date like Aug 1 or Jan 17, 2028 stays together. A narrow column now wraps before the date, never between the month and the day.',
  ],
}

export default note
