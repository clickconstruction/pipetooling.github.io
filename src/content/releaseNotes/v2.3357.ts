import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3357',
  date: '2026-09-12',
  title: 'Bid Costs: click a bar, get its bids',
  kind: 'feature',
  highlights: [
    'On History & forecast, clicking a slice of a bar now opens a window listing the bids in it, with the month\'s Won / Lost / Open chips to switch slices in place and ‹ › to step months without closing.',
    'The window says who and which GCs make up the slice; tap a name to narrow the list. Click a bid to open it on top; close it and you are back on the list. Copy list puts the bids on the clipboard.',
    'Every other number on the lens (odds cards, age buckets, tiles, person rows) opens the same window.',
  ],
}

export default note
