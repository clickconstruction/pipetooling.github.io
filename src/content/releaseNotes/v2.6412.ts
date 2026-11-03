import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6412',
  date: '2026-11-02',
  title: 'The Signed hours statement prints as one full-width paper',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The worker, period, job, customer, site and approver sit in one band across the top, and the day table takes the whole width. Before, the table was squeezed into the right half of every page.',
    'Each day is one line: the day, in and out together, the hours to two decimals, what they were working on, the amount. A long note takes its own line under its day.',
    'The rate is stated once in the band when it is the same all period. A week’s subtotals sit under Hours and Amount.',
    'The column header repeats on every page, no day splits across pages, and a quarter prints in three pages instead of five.',
  ],
}

export default note
