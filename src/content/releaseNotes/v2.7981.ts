import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7981',
  date: '2026-11-19',
  title: 'Maps: every Google map on the screen hears a refused key',
  kind: 'fix',
  highlights: [
    'When Google refuses the map key, every Google map on the screen now falls back to the other map. Before, only the map opened last was told.',
    'This matters when a window with a map opens over a page that has a map of its own.',
    'The steps a Google map takes before it falls back now live in one place, ready for painted maps on Google.',
    'Nothing else on a screen changes. The seven Google maps draw as they did.',
  ],
}

export default note
