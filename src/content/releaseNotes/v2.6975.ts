import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6975',
  date: '2026-11-11',
  title: 'The Bid Board shows what we win, by the size of the bid',
  kind: 'feature',
  highlights: [
    'On Bids, the Bid Board’s Health section has a new chart under the Pulse. It reads what we win by the size of the bid.',
    'There is one row for each size, from under $10k to over $500k. Each row shows the share won by dollars, and how many bids were won, lost, or have no mark.',
    'A bid counts as won or lost only when it is marked. A bid with no mark counts as half lost after 90 days and 95% lost after 180 days.',
    'The chart reads the bids the board is showing, so it follows the trade you pick.',
  ],
}

export default note
