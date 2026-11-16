import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7425',
  date: '2026-11-15',
  title: 'Lien desk: the cards that open on To do stay on the screen',
  kind: 'fix',
  highlights: [
    'On a short screen, the card that opens when you point at a chip on the Board could hang off the bottom. It now opens over the chip when there is no room under it, and beside the chip when neither fits.',
    'On a To do row, pressing the bin’s name opens a card of its steps. For a row low on the screen that card opened below the fold. It now opens over the row.',
  ],
}

export default note
