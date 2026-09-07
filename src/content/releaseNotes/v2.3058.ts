import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3058',
  date: '2026-09-07',
  title: 'A save that didn’t apply now always says so',
  kind: 'fix',
  highlights: [
    'Every bid update, the robot request toggle, the Robot queue’s axis and hold-out saves, the Counts undo, and takeoff line saves now check that the row was actually written — a refused save shows “Save didn’t apply” instead of closing as if it worked.',
    'Refused saves are counted by table and role so the office can see where permissions bite.',
  ],
}

export default note
