import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5758',
  date: '2026-10-23',
  title: 'Legal: the county map zooms, and shows today’s cases while you color',
  kind: 'feature',
  highlights: [
    'The county map on Settings → Collections law firms opens on Central Texas and zooms at the pointer: scroll or pinch, press + and −, drag to move, and the two view buttons bring it back. County names draw as you zoom in.',
    'Today’s Collections accounts sit on the map as small dots at their job’s address, colored by where each stands, so a dev sees where the cases are while coloring counties.',
    'A card under the firm cards lists the cases in the county under the pointer, with each balance and an Open on the desk link. Click a dot to hold that case on the card; a dot click never colors a county.',
  ],
}

export default note
