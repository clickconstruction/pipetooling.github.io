import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2137',
  date: '2026-08-23',
  title: 'Adopt an existing bid into a package',
  kind: 'feature',
  highlights: [
    'The Workbench door has a third move: Adopt an existing bid. Pick one or more bids already on the board (same customer first) and they become bids in this package — counts, takeoff, price scenarios, and GC come along.',
    'The adopted bid\'s sent date and value become that bid\'s send history; its old board row retires (nothing is deleted, and the bid number still looks up). Labor and cost stay the package\'s.',
    'Bids adopted into a package leave the Bid Board, Followup, and Documents lists, so a project that was six rows becomes one.',
  ],
}

export default note
