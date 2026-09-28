import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4012',
  date: '2026-09-28',
  title: 'GC Review: the pay date shows for GCs under $10,000 too',
  kind: 'fix',
  highlights: [
    'A pay date saved with a word now shows on the GC’s row and header whatever the GC owes — “pays by Oct 9”. Before, GCs under $10,000 kept the date but never showed it.',
    'The same GCs now turn red and move to the top of their group when that date passes with money still owed.',
  ],
}

export default note
