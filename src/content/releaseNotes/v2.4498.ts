import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4498',
  date: '2026-10-04',
  title: 'AIA G702-G703: more than one line on the continuation sheet',
  kind: 'feature',
  highlights: [
    'A pay application now has lines. Each line is a row of the continuation sheet, with its own scheduled value, previous work, work this period and stored material.',
    'Type a line’s percent done and the work this period is worked out. Or type the dollars.',
    'Add a line with one button, for a change order or a piece of the contract. The next application carries every line forward.',
    'The sheet holds 34 rows. The form shows how many are used and says so before Generate when there are too many.',
  ],
}

export default note
