import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7091',
  date: '2026-11-12',
  title: 'Supply houses: every bill shows its lines, however many bills the house has',
  kind: 'fix',
  highlights: [
    'A supply house with many bills now shows the right Lines note on every bill. Before, the newest lines could be left out, and a bill could read 0 lines when its lines were on file.',
    'The Look window opens with all of a bill’s lines on such a house too.',
    'When the lines cannot be read, the bills read No lines yet until the next load. A bill never shows with only some of its lines.',
  ],
}

export default note
