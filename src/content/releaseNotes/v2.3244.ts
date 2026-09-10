import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3244',
  date: '2026-09-10',
  title: 'Vendor kind is the one switch',
  kind: 'fix',
  highlights: [
    'Under the hood: the old "not a supplier we quote from" flag on supply houses is gone. The Kind chips on the vendor form (Supply house, Insurer, Rental yard, Sub ledger, Other) are now the only thing that decides which houses estimators and the price-request pickers see. Nothing changes on screen.',
  ],
}

export default note
