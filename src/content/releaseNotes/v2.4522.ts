import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4522',
  date: '2026-10-04',
  title: 'Pipeline: the Map button sits right of the search box',
  kind: 'fix',
  highlights: [
    'When the map is hidden, the Map button that brings it back now sits at the right end of the search box. It was between Forecast and the search box.',
    'It is the same height as the search box, so the two read as one row.',
  ],
}

export default note
