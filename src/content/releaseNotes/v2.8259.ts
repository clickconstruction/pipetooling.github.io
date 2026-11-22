import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8259',
  date: '2026-11-21',
  title: 'Bid Board: a link to a bid now brings that bid into view',
  kind: 'fix',
  highlights: [
    'Open the bid, on a bid’s photo in Documents → Photos, opened the Bid Board at the top and left you to find the bid. It now scrolls to the bid and rings it.',
    'The same holds for every link that lands on a bid on the Bid Board. On a long board the link used to stop short of the bid while the board was still loading.',
    'Scroll, tap or type while the board is finding the bid and it lets go at once. The page is yours.',
  ],
}

export default note
