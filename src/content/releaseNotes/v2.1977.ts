import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1977',
  date: '2026-08-21',
  title: 'Accounts Receivable and Fix-ups join the money cards',
  kind: 'feature',
  highlights: [
    "Accounts Receivable is now a standing card in Today's Money Opportunities: \"Allocate N bank deposits\" with an amber count when money is waiting, and a quiet \"open to review payments\" card when everything's applied.",
    'Fix-ups moved from the strip below into its own amber-edged card in the same grid — chips inside, and the card disappears entirely when the data is clean.',
  ],
}

export default note
