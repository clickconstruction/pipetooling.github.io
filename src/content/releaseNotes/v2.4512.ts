import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4512',
  date: '2026-10-04',
  title: 'Pipeline: a stage bar that stays with you, and colored section headers',
  kind: 'feature',
  highlights: [
    'The row of section links under the map is now a stage bar. Each stage shows its count and its dollars, and a click opens that section and jumps to it.',
    'The bar stays at the top of the window while you scroll, and the stage you are scrolling through is lit in its color.',
    'Each section header is now a band in the same color as that stage’s pins on the map, with the count in a pill and the dollars beside it.',
    'A stage with nothing in it stays in the bar, greyed, so the bar never shifts. Phones keep their stage chips.',
  ],
}

export default note
