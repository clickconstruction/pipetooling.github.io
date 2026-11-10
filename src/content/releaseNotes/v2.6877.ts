import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6877',
  date: '2026-11-10',
  title: 'Permits: the map on a skim card is a Google map',
  kind: 'fix',
  highlights: [
    'The small map at the top of a skim card is now Google’s, in place of the OpenStreetMap picture. The permit still sits in its middle and a press still opens Google Maps.',
    'The miles from the office moved to the top of that map, so Google’s mark and terms along the bottom stay clear.',
    'If Google cannot draw the map, the card falls back to the map it had before.',
  ],
}

export default note
