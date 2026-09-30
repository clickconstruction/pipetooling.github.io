import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4219',
  date: '2026-09-30',
  title: 'The Bridge: Vectors by the day zooms out to weeks and months',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The Vectors by the day panel gains a zoom row: Days is the month you had; Weeks draws the last thirteen pay weeks, one cell per person per week; Months draws the last twelve months, one cell per person per month.',
    'A week or month cell is the same days folded — the same green-or-red verdict and the same shade by dollars per hour — so a person’s month here equals the sum of their week columns on the Days view.',
    '‹ › steps a month, thirteen weeks or twelve months at a time; the running period reads “so far”.',
  ],
}

export default note
