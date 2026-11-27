import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8711',
  date: '2026-11-27',
  title: 'The Retry on the “Could not reach the app” line fits a thumb on a phone',
  kind: 'fix',
  highlights: [
    'On a phone, the small Retry at the end of the red “Could not reach the app.” line was only 22 px tall to press.',
    'It now takes a press across 44 px, the size of a fingertip, and looks the same.',
    'The same goes for the other small presses that line can carry. At a desk nothing changes.',
  ],
}

export default note
