import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3497',
  date: '2026-09-16',
  title: 'The to-do board writes itself',
  kind: 'fix',
  highlights: [
    'Work saved for someone else to pick up is now written in one place, and both the to-do index and the punch-list board are generated from it — so neither can quietly fall behind again.',
    'Three to-dos written in the previous two days had no row on the board at all, and four rows still advertised work that had already shipped. All of them are corrected.',
  ],
}

export default note
