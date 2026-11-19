import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7949',
  date: '2026-11-19',
  title: 'On the smallest phones the Bids page no longer slides sideways',
  kind: 'fix',
  highlights: [
    'On a 320 px phone the Bids pages slid a pixel or two sideways. The top bar holds one more button there, Bid, and the gear at its right end ran past the edge of the screen.',
    'When the top bar has no room left, its coloured buttons now give up a sliver of their padding, just enough for the gear to stay on screen. Their icons stay the same size.',
    'Wider phones are unchanged, and so is every page whose top bar already fitted.',
  ],
}

export default note
