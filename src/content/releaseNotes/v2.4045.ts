import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4045',
  date: '2026-09-28',
  title: 'Contract sweep: a full-screen button in the title bar',
  kind: 'feature',
  highlights: [
    'A button beside ⋯ in the Contract sweep’s title bar jumps the window to the whole screen and back. It shows the state you are in and names the other: Full screen, then Back to a window.',
    'The sweep remembers your choice on this computer, so it opens the way you left it. Escape and the × close it as before.',
    'Phones already show the sweep edge to edge, so the button is not there.',
  ],
}

export default note
