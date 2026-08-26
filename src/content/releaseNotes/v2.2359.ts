import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2359',
  date: '2026-08-26',
  title: 'The Pricing Tape — a calculator that lives on the Pricing tab',
  kind: 'feature',
  highlights: [
    'A small calculator icon now floats in the corner of Bids → Pricing. Click it and a tape calculator unfolds — an amber ring and a "keys land here" chip make it unmistakable when your keystrokes go to the calculator instead of the page.',
    'Every calculation prints to a searchable paper tape with "minutes ago" timestamps. Click an old line to roll back to it, or type right after = to label the line — search finds notes too.',
    "Paste works like you'd hope: ⌘V drops a copied price into the display, and a whole column of prices from a spreadsheet sums into one tape line. Click the big result to copy it back out.",
  ],
}

export default note
