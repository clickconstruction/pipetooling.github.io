import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8524',
  date: '2026-11-24',
  title: 'Bills sent: By day paid no longer names deposits from before Accounts Receivable’s start date',
  kind: 'fix',
  highlights: [
    'In By day paid, an old month named bank deposits as on no bill yet when they came in before the office began matching deposits in the app. Accounts Receivable does not list those deposits, so Open deposits led to a list without them.',
    'The line now names only the deposits Accounts Receivable lists. A month from before its start date shows no such line.',
    'When the office’s deposit settings cannot be read, the line says the bank deposits did not read instead of guessing.',
  ],
}

export default note
