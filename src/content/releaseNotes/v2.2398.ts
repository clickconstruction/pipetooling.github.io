import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2398',
  date: '2026-08-27',
  title: 'Add a book entry straight from the assign search',
  kind: 'feature',
  highlights: [
    'The Workbench\'s assign… dropdown now has the Old page\'s add door — "+ Add … to the book" sits at the foot of the list, pre-filled with what you typed, even when there are near-miss matches.',
    'Entries added this way land in the book this bid actually prices from, so they show up in the search immediately — and a row with the same name prices itself on the spot.',
    'The Old view\'s add button got the same fix (it was quietly filing new entries into the shared catalog instead of your bid\'s book).',
  ],
}

export default note
