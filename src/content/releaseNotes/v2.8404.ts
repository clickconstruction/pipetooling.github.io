import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8404',
  date: '2026-11-23',
  title: 'Smaller cents in Banking and Pay',
  kind: 'feature',
  highlights: [
    'The cents are now smaller than the dollars across Banking: the ledger, User Sort, Drag Sort, Accounting, the reviews, Reconciliation and a transaction’s window.',
    'The same in Pay: the pay stub windows, the payroll forecast, the catch-up window and recording a stub’s payment.',
    'The digits are unchanged, and selecting and copying still gives the whole figure.',
  ],
}

export default note
