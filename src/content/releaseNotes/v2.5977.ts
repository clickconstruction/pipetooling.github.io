import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5977',
  date: '2026-10-27',
  title: 'A bid room chip no longer drags the Bid Board sideways',
  kind: 'fix',
  highlights: [
    'On a phone, a bid card whose GC line carried a bid room chip ran past the edge of the card. The whole Bid Board then dragged sideways, and the GC’s name was squeezed out of sight.',
    'The room chip now drops to its own line under the GC when the two do not fit side by side. The GC’s name gets its room back.',
    'A room chip too long for the card ends in an ellipsis instead of running off the screen. Wider screens look the same as before.',
  ],
}

export default note
