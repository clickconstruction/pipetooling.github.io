import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4237',
  date: '2026-09-30',
  title: 'Robots: “Make a fresh one” breaks where it reads',
  kind: 'fix',
  roles: ['dev', 'estimator'],
  highlights: [
    'In Bids → 🤖 Robots, when a “Set up on this Mac” code runs out before it is used, the button that makes a new one no longer leaves “one” alone on the second line. When the window squeezes it, it reads “Make a” over “fresh one”.',
  ],
}

export default note
