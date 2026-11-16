import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7468',
  date: '2026-11-16',
  title: 'GC difficulty rating: an estimator can rate a GC',
  kind: 'fix',
  highlights: [
    'Estimators can now rate a GC, on the GC’s record and from a bid on the Bid Board. The price list’s Who may rate a GC names the office, the estimators and the masters.',
    'The save now obeys that list. Before, an estimator the list named was offered Save and then refused, and a group taken off the list could still save.',
    'An estimator does not read a GC’s bills, so their rating keeps the Paying point the rating already holds, with its words.',
    'The ask at the end of a job shows only to a master the price list lets rate.',
  ],
}

export default note
