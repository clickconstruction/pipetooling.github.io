import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2845',
  date: '2026-09-05',
  title: 'Customer portal: every bill fits a phone',
  kind: 'fix',
  highlights: [
    'On a phone, each bill on the customer statement is now its own card — date and age, the note, the amount due, and a full-width PAY ONLINE button (or the check reference). Nothing starts off-screen.',
    'Before, the ledger kept its desktop width inside the phone sheet: the amount and the pay button sat hidden behind a sideways scroll with no cue that it existed.',
    'Desktop and tablet keep the ruled ledger; the printed statement is unchanged.',
  ],
}

export default note
