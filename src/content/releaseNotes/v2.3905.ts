import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3905',
  date: '2026-09-27',
  title: 'My Time day editor: what Save writes, and when, has tests',
  kind: 'fix',
  highlights: [
    'The rules behind the day editor’s Save button lived inside the editor with no tests: every part needs a note and at least 0.01 hours, a clock that is still running is measured up to now, and a running clock alone never counts as an edit.',
    'Those rules are now two small tested pieces — one for what a save writes, one for which blocks of the day changed — with 39 tests between them.',
    'Nothing on screen changes; every save writes what it wrote before.',
  ],
}

export default note
