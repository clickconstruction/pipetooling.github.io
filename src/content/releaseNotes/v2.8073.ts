import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8073',
  date: '2026-11-20',
  title: 'Boxes: Use my location on the Tally’s maps no longer pins a box from a rough area, and a map with nowhere to open can still be dragged',
  kind: 'fix',
  highlights: [
    'On the Tally, Use my location on the map you pin a box with, and on the site map, no longer moves the map to the middle of a rough area. The line says Precise Location looks off and lists the steps for your phone.',
    'A box’s pin never takes its margin from a rough area, so a box no longer reads as pinned within two miles.',
    'When a job has no address on the map and no pinned box, a rough area or a phone with location off now opens the map wide. Zoom in and drag it to the box. Put here waits until you have dragged the map.',
  ],
}

export default note
