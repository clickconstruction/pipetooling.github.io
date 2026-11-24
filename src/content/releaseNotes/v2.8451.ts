import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8451',
  date: '2026-11-24',
  title: 'Bills sent: a bill’s record goes back to the day it was opened from',
  kind: 'fix',
  highlights: [
    'Open a bill’s record from a day of By day paid, and its back link now returns to that day, under the same chip. The link names the day, like ← What came in Mon, Nov 23.',
    'Before, the link read ← All bills sent and opened the other view, so the day was lost at each bill.',
    'A record opened from the list still goes back to the list.',
  ],
}

export default note
