import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6668',
  date: '2026-11-08',
  title: 'A check on the Your week sheet no longer fails in the evenings',
  kind: 'fix',
  highlights: [
    'A behind-the-scenes check on the Your week sheet failed every evening from 6 PM to midnight, because it read the date the way the rest of the world does instead of the company’s own calendar. It now reads the company’s day, as the sheet itself always has. Nothing on a screen changes.',
  ],
}

export default note
