import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7156',
  date: '2026-11-13',
  title: 'Materials: price a site’s rows one at a time',
  kind: 'feature',
  highlights: [
    'On a site’s materials screen, press Worth and then Price rows one at a time. A window asks about one row with no price, then the next.',
    'Each row shows the parts-book parts that fit its name, with each one’s price and the day it was checked. Press one, or its number key, and the row takes that part’s price.',
    'The window also shows what a supply house bill paid for a line that fits. That is to read for now and cannot be pressed.',
    'An offer is a guess and counts for nothing until you press it. Skip moves on, and Undo takes the last answer back.',
  ],
}

export default note
