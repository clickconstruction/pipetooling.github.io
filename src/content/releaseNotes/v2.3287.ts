import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3287',
  date: '2026-09-11',
  title: 'Dashboard tells devs when the robots have work waiting',
  kind: 'feature',
  highlights: [
    'A new Needs You line for devs: "Robots have work waiting — 4 bids want a shadow (oldest asked 3 days ago) · 2 price matrices queued (oldest 5 hours)", naming the first of each.',
    'Blue while it is just a pile; amber when something is stuck — a matrix the robot went quiet on, or a bid request over a week old.',
    'Open the Console lands on Robots → Console where the kickoffs live. Snooze it for a day or dismiss it until the count rises. It disappears when the robots are caught up.',
  ],
}

export default note
