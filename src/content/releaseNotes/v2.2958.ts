import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2958',
  date: '2026-09-06',
  title: 'Safety net under six pay, bank and schedule calculations',
  kind: 'infra',
  highlights: [
    'Nothing changes in the app. Six calculations that had no automated tests — the bank-statement import parser, proportional hours scaling, the day job-mix percentages, schedule overlap checks, and the salaried workday resolver — now have 63 tests pinning how they behave, so a future change cannot quietly alter pay or the bank feed.',
  ],
}

export default note
