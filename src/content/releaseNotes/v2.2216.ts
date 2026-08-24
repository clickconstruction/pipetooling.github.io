import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2216',
  date: '2026-08-23',
  title: 'Removing a GC no longer leaves a ghost on the Send to strip',
  kind: 'fix',
  highlights: [
    'Deleting a GC\'s last version now also removes the "Also sent to" record that ＋ Add GC created, so the GC disappears cleanly instead of lingering as an un-removable "same letter" chip.',
    'Shared-letter chips on the strip now have an × — remove any "Also sent to" GC right there (with a confirm), same as the × in Edit Bid.',
  ],
}

export default note
