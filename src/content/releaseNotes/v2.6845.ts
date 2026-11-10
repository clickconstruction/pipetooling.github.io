import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6845',
  date: '2026-11-10',
  title: 'A customer who pays in kind carries a chip beside the name',
  kind: 'feature',
  highlights: [
    'On the Customers list and the customer’s page, a chip beside the name says the customer pays in kind and what is still to come.',
    'The chip turns amber when a month’s credit is waiting. Press it to open the ledger.',
    'On the Customers list, Total open balance now counts money owed only. What a deal pays is named under it as scheduled in kind.',
    'Owes money leaves that part out too, and a new In kind filter lists everyone who pays this way.',
  ],
}

export default note
