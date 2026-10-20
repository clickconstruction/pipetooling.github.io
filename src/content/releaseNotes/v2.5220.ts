import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5220',
  date: '2026-10-10',
  title: 'The Bridge: Fix the reading, every gap with what it moves and its door',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A new panel under the top line lists what makes the page read low or thin: unapproved hours, a typed cash figure that drifted from the bank, jobs with no % or no price, unsorted bank rows, bids with no value.',
    'Each row says what it moves, in dollars where it can, and ends in the door that fixes it. The biggest mover is first.',
    'The Data gaps strip at the bottom and the Truth check’s chip rows are gone; this panel is their one home.',
  ],
}

export default note
