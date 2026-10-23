import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5755',
  date: '2026-10-23',
  title: 'Robots: the round names only the plumbing bids it passed over',
  kind: 'fix',
  highlights: [
    'The Rounds card’s Queue line now names only plumbing bids the robot passed over, the same bids the Queue lists under Held.',
    'The robot no longer takes a bid that was adopted into another bid’s package, which already left every board list.',
  ],
}

export default note
