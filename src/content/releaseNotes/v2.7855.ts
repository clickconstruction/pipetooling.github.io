import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7855',
  date: '2026-11-18',
  title: 'Pricing: a row can be a percent of other rows, and it follows them',
  kind: 'feature',
  highlights: [
    'Bids → Pricing has a new press, ＋ Percent row. It adds a row priced as a percent of other rows, such as Connections at 40% of the pipe.',
    'The window draws the new row at its top as the table will show it, and its button says the price it will add.',
    'The row follows its rows: change a footage or a pipe price and its price moves by itself, until the bid is marked sent.',
    'Type a price over the row to drop its rule. Press its chip to change the percent or the rows.',
  ],
}

export default note
