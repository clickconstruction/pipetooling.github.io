import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3869',
  date: '2026-09-26',
  title: 'Estimates: the list table and cards are their own piece',
  kind: 'fix',
  highlights: [
    'The estimate list — the table on a desk and the cards on a phone — moved out of the Estimates page into its own component file, unchanged, with a smoke test that mounts both on the same rows. The Estimates page is a fifth shorter.',
    'Nothing on screen changes.',
  ],
}

export default note
