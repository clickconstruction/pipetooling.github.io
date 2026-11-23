import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8368',
  date: '2026-11-23',
  title: 'Before we start: Is it as told? marks only the things it showed you',
  kind: 'fix',
  highlights: [
    'A card left open while the office added a thing to the list, or gave a No a new yes, could mark that thing as seen by us when you pressed Yes, all as told. Nobody had looked at it.',
    'The card now sends the list it showed, and only those things are marked. A thing it did not show keeps the customer’s word on it with no mark of ours, for the office to tick.',
  ],
}

export default note
