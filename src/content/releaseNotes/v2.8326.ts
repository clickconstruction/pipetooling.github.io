import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8326',
  date: '2026-11-22',
  title: 'Painted maps: the magnifying glass on Google Maps is sharp',
  kind: 'fix',
  highlights: [
    'On a phone, the magnifying glass that shows the spot under your finger was blurry on Google Maps. It now shows the closest photograph Google has of that spot.',
    'In a town the glass is now as sharp as the photograph gets. Where Google has nothing closer, it looks as it did before.',
    'The glass can take a moment to sharpen the first time you hold a press. Streets is sharp in the glass too.',
  ],
}

export default note
