import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3380',
  date: '2026-09-13',
  title: 'Accounts Receivable: the deposit leads with who paid, a meter shows what is left, and allocations read as ledger lines',
  kind: 'feature',
  highlights: [
    'The right pane opens with the payer’s name, then amount · kind · posted date and the bank’s note or memo on one line. Under it a meter fills green as you allocate and reads Remaining $1,855.70, Fully allocated ✓, or Over by $20.00.',
    'Each allocation is one row — kind · bill or payment · amount · × — with + Split across another bill underneath instead of a full-size button.',
    'The memo box is gone from the top of the pane: · Add a note opens it only when you have something to say.',
  ],
}

export default note
