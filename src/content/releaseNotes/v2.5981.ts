import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5981',
  date: '2026-10-27',
  title: 'Clock In, the Calendar, the Bids switch and the portal’s small print are easier to read',
  kind: 'fix',
  highlights: [
    'Clock In keeps its orange and now writes its words in near-black, so they read in sunlight. The Job Mode Clock In and the orange Clocked in today strip match it.',
    'In dark mode the Calendar’s dates are a light blue, and the planned job chips keep their words dark. The other months’ dates are a darker grey in light mode.',
    'In dark mode the picked side of the Trades and GC switch on Bids writes its word in dark on the light violet.',
    'The customer portal’s small print, labels and dates are a darker grey. The pay page, the trade partner and law firm pages and the printed packets share it.',
  ],
}

export default note
