import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5753',
  date: '2026-10-23',
  title: 'Robots: the Queue and the rounds read one rule',
  kind: 'fix',
  highlights: [
    'The Queue’s Ready list is now exactly what the robot takes next, top row first. The Console’s counts and the Dashboard’s Robots have work waiting line read the same rule.',
    'The Queue has a Held list. It shows each live bid with plans the robot passes over and why, like a bid made over 30 days ago that nobody asked about.',
    'The Console’s Rounds card has a Queue line from the robot’s own check-in. It names the bids it passed over, so found nothing to do never contradicts the Queue.',
    'A bid you took back with Leave this one to me can get a robot again once you untick Don’t let robots shadow this bid.',
  ],
}

export default note
