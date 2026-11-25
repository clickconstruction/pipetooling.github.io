import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8592',
  date: '2026-11-25',
  title: 'Punch list: a card’s pictures page no longer counts as its mock-up',
  kind: 'fix',
  highlights: [
    'A card with a pictures page and no drawing read as having a mock-up. It now reads waiting on a mock-up again, or its own line where the card says no mock-up is needed.',
    'Four cards change: #421 and #284 read waiting on a mock-up, and #188 and #119 read their not required line.',
    'The pictures page keeps its door. It has a chip of its own, named pictures, beside the mock-ups.',
  ],
}

export default note
