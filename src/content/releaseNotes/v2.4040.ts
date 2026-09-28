import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4040',
  date: '2026-09-28',
  title: 'Dashboard clock row: a receipt on Tally, a clock with a plus on the quick clock',
  kind: 'fix',
  highlights: [
    'The Tally square at the left of the clock row now shows a receipt — it opens your spend ledger — instead of the rocket.',
    'The quick clock square after Clock In shows a clock with a plus instead of the words "quick clock", so every square in the row is an icon except Job Report, which keeps its name.',
  ],
}

export default note
