import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7099',
  date: '2026-11-12',
  title: 'The Bridge shows a cash balance beside an accrual balance, each with its runway in days',
  kind: 'feature',
  highlights: [
    'The top of the Bridge now reads Made last week, Slowest step, then two balances side by side.',
    'Cash balance is cash on hand today. Accrual balance adds what customers owe you and takes off what you owe, subs included. Press it to open Money owed.',
    'Under each balance is its runway in days: how long it lasts on payroll and overhead with nothing coming in.',
    'The red band that said cash was under the floor is gone. The cash balance turns red or amber instead, and its line names the day.',
  ],
}

export default note
