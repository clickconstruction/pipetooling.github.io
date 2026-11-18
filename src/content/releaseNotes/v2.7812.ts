import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7812',
  date: '2026-11-18',
  title: 'Header: the green phone button is the same size as the buttons beside it',
  kind: 'fix',
  highlights: [
    'In Job Mode the green phone button in the header was drawn a little bigger than the three coloured buttons to its right.',
    'All four are now one size, with the same top and bottom edges and the same gaps, on a phone and at a desk.',
  ],
}

export default note
