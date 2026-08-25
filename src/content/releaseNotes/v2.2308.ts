import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2308',
  date: '2026-08-25',
  title: 'Click a stage, see its neighborhood',
  kind: 'feature',
  highlights: [
    'Click any stage card on the Map and it focuses: blue ring on the card, amber on the stages that must finish before it, green on the ones it unlocks — wires included.',
    'Everything unrelated fades back, so the two chains read at a glance even on a big map; a small legend explains the colors while you\'re focused.',
    'Click the card again, tap the canvas, or press Esc to clear. Task rows, drags, and search all keep working as before.',
  ],
}

export default note
