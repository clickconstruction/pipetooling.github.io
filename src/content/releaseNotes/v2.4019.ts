import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4019',
  date: '2026-09-28',
  title: 'They said…: take a wrong promise off the record',
  kind: 'feature',
  highlights: [
    '“They said…” on a Billed row now lists every promise on record for that bill — the day, who said it and how, who heard it, and when it was written down.',
    'Each one has “never said that”, for a promise entered on the wrong bill or with a date nobody gave. It asks once, then the promise stops counting for or against the customer.',
    'When it is the promise the board is showing, the date comes off the board too and the row returns to the estimate.',
    'A changed date is still a second promise: save the new date, and the earlier one stays on record as broken.',
  ],
}

export default note
