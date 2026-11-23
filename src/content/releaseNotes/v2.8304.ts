import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8304',
  date: '2026-11-22',
  title: 'Documents → Photos: the list shows the chip you pressed last',
  kind: 'fix',
  highlights: [
    'Press a chip on Documents → Photos while the list is still loading, and the list now shows that chip’s photos and nothing older.',
    'Before, a slow first load could land afterward. It put its red line over photos that had read, or swapped the list back.',
  ],
}

export default note
