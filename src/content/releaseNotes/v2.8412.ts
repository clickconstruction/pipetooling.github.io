import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8412',
  date: '2026-11-23',
  title: 'Supply house bills: every word on a bill becomes searchable',
  kind: 'feature',
  highlights: [
    'When the app reads a supply house bill, it now keeps every word printed on it, such as the ship-to address and who ordered.',
    'The bills already on file get their words too, a few files every ten minutes, with nothing for you to press.',
    'Search every bill then finds a bill by any of those words, and shows the words around the one you typed.',
    'A scanned bill has no words to keep. It is still found by its number, its amount and the parts read from it.',
  ],
}

export default note
