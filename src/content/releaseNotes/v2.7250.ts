import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7250',
  date: '2026-11-14',
  title: 'Materials on site: a pasted invoice reads right, and says what it could not read',
  kind: 'fix',
  highlights: [
    'In a job’s Deliveries panel, a pasted line of 1,000 pieces is read, a part that ends in ST is no longer taken for a street, and the 2 of a 2 1/2" size is no longer taken for the count.',
    'A line the app could not read is listed above the table, with a press to add it by hand. Before, it was dropped without a word.',
    'One figure on a line is no longer taken for the unit price. You say once whether it is the price of each or the line’s total.',
    'Add lines sends the lines its button counts, as one delivery, and says once whether they landed or are waiting for a signal. An invoice already on the job asks before it lands again.',
  ],
}

export default note
