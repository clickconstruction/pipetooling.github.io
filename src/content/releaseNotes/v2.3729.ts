import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3729',
  date: '2026-09-22',
  title: 'Hiring: the try-out loop ran live end to end — and a skipped card no longer reads as “waiting”',
  kind: 'fix',
  highlights: [
    'The whole helper try-out loop was run for real on test accounts: Try out made the logins, the leaders were asked at their own clock-out and on their Dashboard, the Try-out card tallied the answers by name, and Keep trying quieted the suggestion.',
    'A leader who skipped the card is now shown as “skipped the card” on the Try-out card instead of “not answered yet”, and the office is not told it is waiting on them — a skipped card never comes back.',
  ],
}

export default note
