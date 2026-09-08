import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3145',
  date: '2026-09-08',
  title: 'Your jobs on a map can draw with Google Maps',
  kind: 'feature',
  highlights: [
    'The Dashboard\'s Your jobs on a map card now uses Google Maps — the familiar roads, labels, and dark mode — when the company has a Google Maps browser key set up.',
    'If Google Maps isn\'t configured, doesn\'t load, or rejects the key, the card quietly draws the same pins on OpenStreetMap instead, so the map is never blank.',
  ],
}

export default note
