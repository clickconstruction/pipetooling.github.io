import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7473',
  date: '2026-11-16',
  title: 'Painted maps: throwing a map away takes its photos',
  kind: 'fix',
  highlights: [
    'Throw this map away now removes the map’s photos from storage too. Before, the photos stayed behind with nothing pointing at them.',
    'The map goes first and the photos after. If a photo cannot be removed, the map is still gone and nothing is shown.',
    'When someone who is not office throws away a map a teammate added a photo to, that one photo stays until the office removes it.',
  ],
}

export default note
