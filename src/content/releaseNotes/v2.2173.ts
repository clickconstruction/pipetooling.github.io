import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2173',
  date: '2026-08-23',
  title: 'Payroll: the reports table is now headed "Pay reports"',
  kind: 'fix',
  highlights: [
    'The table of generated pay reports on People → Payroll was headed "Ledger"; it now says "Pay reports", so the new Ledger view (dev) and the reports table no longer share a name.',
  ],
}

export default note
