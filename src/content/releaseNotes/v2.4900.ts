import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4900',
  date: '2026-10-07',
  title: 'Settle up owes the same as Balances and Record payment',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Settle up now reads the same owed figure as Payroll → Balances and Record payment. A pay report owes its net pay: its gross, less its Less lines, plus its Additional lines.',
    'Before, Settle up counted a report’s gross, so a report with a Less line could show money still owed that could not be paid.',
  ],
}

export default note
