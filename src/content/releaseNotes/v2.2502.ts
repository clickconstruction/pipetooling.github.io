import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2502',
  date: '2026-08-30',
  title: 'Edit Bid saves only what you changed',
  kind: 'fix',
  highlights: [
    'Saving the Edit Bid form no longer writes back fields you never touched — so a plans link (or any other detail) that landed after the board loaded can’t be silently erased by an unrelated Save.',
    'Saving with no changes now writes nothing at all.',
  ],
}

export default note
