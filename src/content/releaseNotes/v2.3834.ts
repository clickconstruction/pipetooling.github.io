import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3834',
  date: '2026-09-25',
  title: 'My Time: Apply Schedule % works on a payroll-period day you open for yourself',
  kind: 'fix',
  highlights: [
    'Opening your own day from People → Draft Payroll (or the Payroll ledger) and pressing Apply Schedule % on a day with two or more scheduled jobs failed with “Session is outside the editable current week” when the day was before this week.',
    'It now splits the session the same way the rest of that day editor saves: through the payroll-access path that is allowed to edit the pay period.',
  ],
}

export default note
