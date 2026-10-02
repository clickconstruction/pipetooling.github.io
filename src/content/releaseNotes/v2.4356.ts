import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4356',
  date: '2026-10-01',
  title: 'A click outside a window no longer opens or shuts the row behind it',
  kind: 'fix',
  highlights: [
    'On the Bid Board, a click outside a GC’s notes also opened or shut the bid’s row. Now it closes the notes only.',
    'On the Checklist, a click outside Cost this task also showed or hid that task’s activity. Now it closes the window only.',
  ],
}

export default note
