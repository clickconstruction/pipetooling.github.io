import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3172',
  date: '2026-09-08',
  title: 'Every vendor has a kind',
  kind: 'feature',
  highlights: [
    'A supply house record now says what it is: Supply house, Insurer, Rental yard, Sub ledger or Other. The "not a supplier we quote from" checkbox is gone; pick the kind on the form instead.',
    'Only supply houses show up when you send price requests, plug in quotes, or open the estimator\'s Supply houses tab. Insurers, the rental yard and the other ledger-only vendors stay with the office.',
    'The office Directory has a kind filter — All kinds, Supply houses, Insurer only, and so on — and counts coverage over supply houses only.',
  ],
}

export default note
