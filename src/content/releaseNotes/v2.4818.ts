import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4818',
  date: '2026-10-07',
  title: 'Uncollectible: Put back fits its column, and the stripes run straight across the row',
  kind: 'fix',
  highlights: [
    'The button under a stamped row now reads Put back. The longer label ran past the edge of the action column.',
    'The faint stripes behind an Uncollectible row are one pattern across the whole row. They used to restart at every column.',
  ],
}

export default note
