import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3582',
  date: '2026-09-18',
  title: 'Payroll backfill: tracking starts April 1, 2026',
  kind: 'infra',
  highlights: [
    'The backfill now treats April 1, 2026 as the day tracking began: earlier Cash App sends are filed as before records, earlier recorded payments are left alone, and each person’s standing counts only pay weeks ending on or after that date.',
    'The date is one setting the plan states in its header, so every column of the by-person table uses the same start.',
    'Nothing changes on screen in this release.',
  ],
}

export default note
