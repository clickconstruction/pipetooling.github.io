import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7882',
  date: '2026-11-18',
  title: 'Pay: the dev seat’s plan reads a salaried person’s own week',
  kind: 'fix',
  highlights: [
    'A salaried person can be paid a week of their own days and hours. The agent’s pay plan now reads that week from the pay row.',
    'The weekly figure, the weeks payroll catch-up will show and the job labor words are priced with the person’s week, not a flat 8 hours on five weekdays.',
    'The agent reads the week and does not set it. A week changed by anyone after the plan refuses the apply.',
    'The workday schedule still draws one 8-hour block. For a person on a shorter week the plan says the clock shows 8 hours while pay follows the week.',
  ],
}

export default note
