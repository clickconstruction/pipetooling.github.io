import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4361',
  date: '2026-10-01',
  title: 'Holding a press inside a window no longer marks or moves the row behind it',
  kind: 'fix',
  highlights: [
    'On the Bid Board, a half-second press inside a GC’s notes or Mark account opened marked the bid behind it. The button you held, like Save, then did nothing. Now the press stays in the window.',
    'On the Checklist, holding a press inside Cost this task picked up the task behind it to drag. Now it stays put.',
    'Holding a row itself still marks the bid or picks up the task, as before.',
  ],
}

export default note
