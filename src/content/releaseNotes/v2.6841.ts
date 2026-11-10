import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6841',
  date: '2026-11-10',
  title: 'A month of in kind credit can be entered before it is due',
  kind: 'feature',
  highlights: [
    'In the ledger, a month that is not due yet has a quiet press, Enter it early. It opens that month’s window.',
    'The window picks the usual credit, since the bank has nothing to say yet. It says the month is not over.',
    'If the amount changes later, take the line back and enter the month again.',
    'Last credit on the card no longer counts a month that already has its line.',
  ],
}

export default note
