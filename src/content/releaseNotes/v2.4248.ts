import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4248',
  date: '2026-09-30',
  title: 'Submittals: set the supply house on a row, for when you buy it somewhere else',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Edit on a submittal row now has a Supply house picker. Pick the house you are buying the part from, or No house. A row added by hand can carry a house for the first time.',
    'The house can be changed on any revision, shared or not. It is the office’s own fact: the GC’s review room never shows it.',
    'The house reads under the product on each row, and on the procurement log and its printed sheet.',
    'Rebuild rows from picks keeps a house you set by hand while the pick behind the row is the same. A new pick on Pricing brings its own house.',
  ],
}

export default note
