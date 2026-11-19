import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7944',
  date: '2026-11-19',
  title: 'Checklist History: no repeating tasks reads as one plain line, not an empty grid',
  kind: 'fix',
  highlights: [
    'On a computer, Checklist → History drew an empty grid for a person with one-off tasks and no repeating task. It showed REPEATING with 0 tasks, the Item and rate headings over no rows, and a small line under them.',
    'Now one line stands there and names the months you picked: No repeating tasks in the last 6 months.',
    'Show 12 months sits beside the line and looks back a full year. At 12 months the line stands alone.',
    'The one-off list under it is unchanged, and so is History on a phone. A person with no history at all no longer gets the empty headings either.',
  ],
}

export default note
