import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7947',
  date: '2026-11-19',
  title: 'Robots: an assistant’s plans count the robots’ scored bids',
  kind: 'fix',
  highlights: [
    'Fixed: before changing who the robots are graded against, a developer’s assistant said no scored robot bid would move. It now counts them.',
    'Fixed: before changing a price in the robot’s price book, it now names the locked robot bids that price reaches.',
    'When it cannot read the robots’ bids it says so, and no longer reads that as none.',
  ],
}

export default note
