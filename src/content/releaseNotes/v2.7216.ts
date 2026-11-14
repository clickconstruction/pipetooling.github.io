import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7216',
  date: '2026-11-13',
  title: 'Materials: Just price, a parts-book price without the re-label',
  kind: 'feature',
  highlights: [
    'In the pricing window each parts-book offer has a second press on its right, Just price.',
    'Pressing the offer itself still says the row is that part: the row takes the book’s name and price.',
    'Just price takes only the price for one piece. The row keeps the name the crew wrote and is not counted as that part.',
    'The price carries the day the parts book last checked it, so an old book price reads as an old price here too. Undo takes it back.',
  ],
}

export default note
