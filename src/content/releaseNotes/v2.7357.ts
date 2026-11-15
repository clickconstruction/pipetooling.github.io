import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7357',
  date: '2026-11-15',
  title: 'The dev seat records a sub payment as the Record payment window does',
  kind: 'feature',
  highlights: [
    'A sub payment recorded from the dev seat is now a sending with its own number, like one recorded in the Record payment window.',
    'It carries how it was sent, from the window\'s own list (Check, Zelle, Mercury, Cash App, Apple Pay, Cash, Client direct, Other), and that method\'s number. So the Subs Ledger\'s How paid column reads for it.',
    'The plan reads back the sending, who it is to and the payment line before anything is written.',
    'An amount past what the sheet still owes is refused from the seat. Money sent past a sheet is placed, or kept as a credit, in the window.',
  ],
}

export default note
