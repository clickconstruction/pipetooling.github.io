import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4880',
  date: '2026-10-07',
  title: 'Bill Customer: saving a missing email no longer wipes the bill',
  kind: 'fix',
  highlights: [
    'When a job had no customer email, saving one in Bill Customer\'s yellow box cleared the bill amount, so Create Stripe invoice failed with "Enter a valid bill amount greater than 0".',
    'The saved email now stays in the window with the amount, the memo and the tab you were on, and the bill goes out on the first try.',
  ],
}

export default note
