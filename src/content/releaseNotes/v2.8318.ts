import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8318',
  date: '2026-11-22',
  title: 'Painted maps: the magnifying glass on Google Maps is sharper',
  kind: 'fix',
  highlights: [
    'When you place a dot or a corner with a finger, the photograph in the magnifying glass is sharper. Before, it was the big map’s picture drawn four times the size.',
    'The glass now asks Google for a closer photograph of the spot. Where Google has no closer one, it shows the closest Google has.',
    'The lines, the places and the cross in the glass sit where they did.',
  ],
}

export default note
