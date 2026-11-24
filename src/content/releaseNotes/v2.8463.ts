import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8463',
  date: '2026-11-24',
  title: 'A customer’s Try again shows its check every time',
  kind: 'fix',
  highlights: [
    'On a customer’s page that did not load, with no signal, the check for a signal was over too fast to see. After the first press, Try again looked as if it did nothing.',
    'Now the page says “Checking for a signal…” for half a second before it answers “Still offline”. Every press visibly does something.',
    'When there is a signal the page reloads at once, as before. Nothing is held.',
    'The Try again press now turns grey in one step while it checks. Its words no longer sit dark on the copper for a moment.',
  ],
}

export default note
