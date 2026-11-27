import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8759',
  date: '2026-11-27',
  title: 'Bids: a row’s split adds up to the row, to the cent',
  kind: 'fix',
  highlights: [
    'On the Pricing Workbench, the three lines under a row, Material, Sales tax and Labor, now always add to the row’s own price, revenue and profit.',
    'On some rows they read one cent over or under. Each line was rounded by itself.',
    'Labor is the line that is what is left, so it takes the cent. Material and Sales tax read as they did, and no saved number changes.',
  ],
}

export default note
