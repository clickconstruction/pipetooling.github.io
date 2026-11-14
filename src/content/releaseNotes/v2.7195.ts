import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7195',
  date: '2026-11-13',
  title: 'Materials on site: a label prints the letter and number alone',
  kind: 'feature',
  highlights: [
    'A printed label now carries only the letter and number a box’s name starts with. A box named G12 COPPER 90 prints as G12, on tape and on the paper sheet.',
    'The label stays true when what the box holds changes, so it can stay on the box. The QR is the same as before and opens the same box.',
    'A name with no letter and number, such as CONCRETE MIX, prints whole. So do two names that would read the same, so no two labels match.',
    'In Print labels each box still shows its whole name, and a line under the boxes says which labels print shorter.',
  ],
}

export default note
