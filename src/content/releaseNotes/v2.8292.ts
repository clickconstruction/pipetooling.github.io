import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8292',
  date: '2026-11-22',
  title: 'Materials on a phone: Missing, Used and Came in read as rows',
  kind: 'feature',
  highlights: [
    'On a phone, the Missing, Used and Came in tiles on a job’s Materials page now open rows you can read. Before, each opened a wide table and most of it was off the screen.',
    'Missing starts with the parts that walked away, each with its number. The parts with nothing walked away wait behind one press that says how many there are.',
    'A count that came up short reads its box, what was expected, what was counted and who counted it. A Can’t find has a red edge.',
    'Used lists every press with its part, what was done, where and who. It shows sixty at a time, with a press for more. On a computer nothing changes.',
  ],
}

export default note
