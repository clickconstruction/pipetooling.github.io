import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6286',
  date: '2026-11-01',
  title: 'The On site tab no longer shrinks on a phone as cages are added',
  kind: 'fix',
  highlights: [
    'On the Tally’s On site tab, the Places row now scrolls sideways inside the screen. Before, with a few places on a job, it pushed the whole page wider than the phone.',
    'A page wider than the phone let Safari zoom the whole app out, so a pinch while scrolling made everything smaller and it stayed that way. The page now fits, and a pinch can no longer shrink it.',
  ],
}

export default note
