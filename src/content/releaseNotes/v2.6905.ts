import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6905',
  date: '2026-11-10',
  title: 'Permits: pick the city on a phone, and Needs you counts every city',
  kind: 'fix',
  highlights: [
    'On a phone, Skim now keeps the city on the strip, beside the magnifier. Before, you had to open Ledger to change city.',
    'The Dashboard’s Needs you line for permits used to count San Antonio only. It now counts all five cities and names each one that has permits waiting.',
    'The line no longer says “About a minute” when more than a dozen permits wait.',
  ],
}

export default note
