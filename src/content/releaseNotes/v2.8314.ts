import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8314',
  date: '2026-11-22',
  title: 'In kind: the customer’s page reads a bill an arrangement pays as scheduled',
  kind: 'feature',
  highlights: [
    'A bill an in kind arrangement pays is no longer on the customer’s statement or in their balance, and it has no pay button.',
    'The bill stays on the page in a card named Scheduled in kind. The card says what the credits have paid and what is still to come.',
    'A customer whose every open bill is on an arrangement reads “Nothing is owed in money” in place of “all paid up”.',
    'The page no longer asks for a pay-by date on such a job.',
  ],
}

export default note
