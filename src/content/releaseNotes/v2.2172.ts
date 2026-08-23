import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2172',
  date: '2026-08-23',
  title: 'Vehicles: tap the reading, see the miles',
  kind: 'feature',
  highlights: [
    'On People → Vehicles, the "229,950 mi · 9d ago" line on each card now opens an Odometer history sheet: every reading newest first, each showing what it added since the one before and who logged it.',
    'Up top, the pace: miles per month and per year (averaged over the whole history), the last-90-days pace with a faster/slower hint, and the total since the first reading. With only one reading the tiles say so — add a second and the averages appear.',
    'There is an Add reading box right on the sheet — type today\'s miles, Enter saves, and the card and history update on the spot.',
  ],
}

export default note
