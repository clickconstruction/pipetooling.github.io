import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2409',
  date: '2026-08-27',
  title: "A packet's ★ price can no longer be deleted from another packet's view",
  kind: 'fix',
  highlights: [
    "Deleting a price now checks whose letter is built on it — every GC packet's ★, not just the packet you're viewing. The Delete button names the packet whose base it is.",
    'The database now refuses the delete too, so no stale screen can break a letter again.',
  ],
}

export default note
