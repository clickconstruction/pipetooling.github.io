import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2726',
  date: '2026-09-03',
  title: 'The Bridge, in plain words — net position and a cash forecast',
  kind: 'feature',
  highlights: [
    'The black line is now your real net position (cash + owed to you − owed by you, collections written off), rebuilt over the last 8 weeks from bank flows, invoices, payments, and supply bills.',
    'The purple line is cash: it drops on the day each bill is due and rises when each receipt is expected — and the readout is a date: the lowest cash point and whether it clears your floor.',
    'Type cash on hand and set the floor right on the page; the ship words are gone from the instruments.',
  ],
}

export default note
