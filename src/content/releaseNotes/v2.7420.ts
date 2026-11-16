import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7420',
  date: '2026-11-15',
  title: 'Jobs → Subs: a sheet paid past its total becomes a credit (sub labor train)',
  kind: 'feature',
  highlights: [
    'A sheet that reads Over now has Keep the $… over as credit… on its ⋯ menu. The window shows which payment changes before anything is saved.',
    'The payment reads what the sheet needed and the rest is kept as the sub’s credit. The next payment to that sub offers the credit first.',
    'The money that left the bank is the same, so a check mark against the bank and a match to a bank line both stay.',
  ],
}

export default note
