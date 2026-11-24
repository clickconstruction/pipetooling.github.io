import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8538',
  date: '2026-11-24',
  title: 'Lien desk: the pinned strip takes a thumb on a phone, and a long chip no longer runs off it',
  kind: 'fix',
  highlights: [
    'On a phone, the line that pins to the top of a notice is now one line that slides sideways. It takes 44 px of the screen, where it wrapped to three lines and took 81.',
    'Each chip on it looks the same and takes a thumb: its touch area is 44 px tall, where it was the chip’s own 18.',
    'The job’s name is cut short on that line, so the first chip is always on the screen.',
    'At a desk, a chip too long for the strip wraps inside its own shape. On a missed notice a long one ran past the pane’s edge and slid the whole pane sideways.',
  ],
}

export default note
