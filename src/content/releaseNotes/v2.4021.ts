import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4021',
  date: '2026-09-28',
  title: 'My Time day editor: what Save writes to the clock has tests',
  kind: 'fix',
  highlights: [
    'When you press Save in the day editor, it decides for each block of the day how to write it back to the clock — a note, new times, a split, or a rebuilt block. That decision was written inside the editor with no tests.',
    'It now lives on its own, word for word, with 64 tests covering every path it can take and every message it can show.',
    'Nothing on screen changes; every save writes what it wrote before.',
  ],
}

export default note
