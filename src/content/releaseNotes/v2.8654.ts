import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8654',
  date: '2026-11-26',
  title: 'The bid window on a phone: the bid’s name gets the top line',
  kind: 'fix',
  highlights: [
    'On a phone, the bid window’s name shared its line with Copy for text, Edit bid and the ✕. The name got about a quarter of the width and broke inside a word.',
    'Now the name has the top line, with the ✕ at its right. Copy for text and Edit bid sit on the line under it.',
    'On a computer the head is as it was, and the presses keep their size.',
  ],
}

export default note
