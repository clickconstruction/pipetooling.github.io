import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2546',
  date: '2026-08-31',
  title: 'NCNS chip fixes from the first live run',
  kind: 'fix',
  highlights: [
    'The red NCNS chip on the schedule board is now clickable on the People week view too (it was only wired on the compact grid), opening the clear-the-mark confirm.',
    'The chip keeps its solid red fill when clickable — it briefly rendered as an empty outline.',
  ],
}

export default note
