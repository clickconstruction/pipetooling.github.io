import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4944',
  date: '2026-10-08',
  title: 'My Time day editor: the arrow keys move a split line where two clock sessions meet',
  kind: 'fix',
  highlights: [
    'In the day editor, the up and down arrow keys now move a split line that sits where two clock sessions meet. Before, it jumped straight back.',
    'A press that ends within a minute of that spot still lands on it, as before.',
  ],
}

export default note
