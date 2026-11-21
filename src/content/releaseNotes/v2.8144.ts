import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8144',
  date: '2026-11-20',
  title: 'Document builder: the Sub NDA’s map reads on a phone',
  kind: 'fix',
  highlights: [
    'On a phone the map’s four column heads are the levels’ bars, so they no longer run into each other.',
    'Each cell there is a small square in its level’s colour, big enough to press, and a changed one is tinted amber.',
    'On a computer the map is as it was: the level’s name over each column and a cell’s words inside it.',
  ],
}

export default note
