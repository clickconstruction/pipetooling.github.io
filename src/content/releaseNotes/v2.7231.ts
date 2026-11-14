import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7231',
  date: '2026-11-13',
  title: 'Subs Ledger: by sub, one sub\'s statement, and on People, Subs',
  kind: 'feature',
  highlights: [
    'The Subs Ledger has a second grouping, By sub: one row per person with their payments in the period, the first and last day, what was paid, what was back-charged and what we owe them today.',
    'Press a name to open that sub\'s statement. It runs oldest first: a sheet adds what was agreed, a payment takes away, and the last column is what we owed after each line.',
    'The statement\'s last row is checked against Balance due on People, Subs. Print the statement or download it as a CSV. People, Subs has a Roster and Ledger switch that opens the same screen on By sub.',
    'The by-date list has a How paid column with the method and its check number, and the search finds a check by its number.',
  ],
}

export default note
