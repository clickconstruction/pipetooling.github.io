import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8337',
  date: '2026-11-23',
  title: 'Dashboard: My Bids reads a bid’s state as the Bid Board does',
  kind: 'fix',
  highlights: [
    'A bid marked Won or Started or Complete with no sent date no longer reads Unsent on My Bids.',
    'A bid someone put away with Archive from board is off My Bids too, as it is off the Bid Board’s unsent pile.',
    'If you hold more than 50 bids, the card now keeps the bids with no answer and your newest ones. Before, it dropped the newest due dates and every bid with no due date.',
    'A sent bid with no answer reads Not yet won or lost, the Bid Board’s own words.',
  ],
}

export default note
