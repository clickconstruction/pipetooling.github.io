import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4243',
  date: '2026-09-30',
  title: 'Procurement log: dates read with a short year, and say how many days ago',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'On Submittals → Procure the Ordered, Expected and Delivered dates read with a two-digit year, like 09/28/26, in a box as narrow as the date.',
    'Under each date a soft line says how far it is from today: 2 days ago, today, or in 12 days. A date the supply house gave still says house said first.',
    'Click, tap or Tab into a date to change it. The full date box opens in place and nothing in the row moves.',
    'A date whose year is far off, like 0001, shows every digit in red with check the year, so a short year cannot hide it.',
  ],
}

export default note
