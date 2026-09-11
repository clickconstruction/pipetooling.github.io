import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3290',
  date: '2026-09-11',
  title: 'Upcoming payroll: who is most of it, and what if someone waits',
  kind: 'feature',
  highlights: [
    'The "upcoming" list on Payroll now opens with a chip per person — their estimated gross and how many weeks — above a table grouped by person, each group folding to one subtotal line.',
    'Tap a chip (or the checkbox on a person\'s row) to leave them out of the estimate. They stay on screen, struck through, and the total says how many are out and by how much. It resets when you close.',
    'Sort by Amount, Name or Hours from the chooser or the column headers; people reorder together, and a person\'s weeks always stay under their name.',
  ],
}

export default note
