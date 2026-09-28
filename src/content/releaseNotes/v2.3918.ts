import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3918',
  date: '2026-09-27',
  title: 'Payroll: the pay reports load from one tested place',
  kind: 'fix',
  highlights: [
    'The read behind every Payroll view — the pay reports with their payments, deductions and additional lines — has tests.',
    'Nothing on screen changes.',
  ],
}

export default note
