import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1928',
  date: '2026-08-20',
  title: '% done over 100 snaps to 100',
  kind: 'fix',
  highlights: [
    'Typing a percent over 100 (or below 0) into the Pipeline board\'s "% done" box used to be silently ignored — the number sat in the box but never saved. It now snaps to the nearest end and saves: 110 becomes 100.',
  ],
}

export default note
