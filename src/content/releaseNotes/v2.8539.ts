import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8539',
  date: '2026-11-24',
  title: 'Bid Board: the missing-address sheet says why, the day, and offers Try again',
  kind: 'feature',
  highlights: [
    'On the Bid Board, the sheet behind “N bids have no map location yet” now says why the map could not place an address.',
    'The row also reads the day it was checked and the day the app asks again by itself, like “Checked Nov 24. The app asks again by itself on Dec 24.”',
    'Try again sits beside Save on such a row. It asks the map services now, so a right address that missed on a bad day does not wait 30 days.',
    'After Try again the row says what happened. A placed bid stays in the sheet as Placed, the way a saved one does.',
  ],
}

export default note
