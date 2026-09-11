import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3318',
  date: '2026-09-11',
  title: 'Pay run: weeks are banded, with the week added up',
  kind: 'feature',
  highlights: [
    'On People → Pay → Payroll → Pay run, a slim tinted band now opens each week of reports, so you can see at a glance where one week ends and the next begins.',
    'Each band names the period and week number and totals the run: how many reports, the hours, the gross pay, and how many are still open.',
    'Rows stay in the order you know; the bands only mark where the week changes.',
  ],
}

export default note
