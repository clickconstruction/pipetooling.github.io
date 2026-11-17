import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7649',
  date: '2026-11-17',
  title: 'Find a file: a signed contract says what it is, and opens its record',
  kind: 'feature',
  highlights: [
    'In Find a file, a hit that is a signed job contract now wears a Signed contract chip. A voided one wears Voided contract.',
    'The office sees Open the contract under the hit. It opens the Contract window on that record.',
    'An estimator sees the chip and opens the file in Drive, as with any hit.',
    'This goes live once the search function is deployed.',
  ],
}

export default note
