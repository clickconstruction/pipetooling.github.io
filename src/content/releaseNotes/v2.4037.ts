import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4037',
  date: '2026-09-28',
  title: 'My Time day editor: five checks that could never run are gone from Save',
  kind: 'fix',
  highlights: [
    'The tests written for the day editor’s Save showed five of its checks could never be reached — an earlier step always decided first. They are removed, so the code that writes your hours is shorter and easier to follow.',
    'Nothing on screen changes; every save writes what it wrote before.',
  ],
}

export default note
