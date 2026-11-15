import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7377',
  date: '2026-11-15',
  title: 'Box labels: the link prints in letters made of whole dots',
  kind: 'feature',
  highlights: [
    'The link on a tape label is now drawn in a font made of the printer’s own dots, the way the QR beside it is. Every stroke is the same weight and every edge lands on a dot.',
    'The code is easier to type when a scan fails. Its capitals are 2 mm tall where they were 1.7, the zero is slashed, and an 8, a B, a 0 and a D no longer print as look-alike blobs.',
    'The label prints the same from every computer. The old type was a Mac’s font, so another computer printed other letters.',
    'A label for G1 to G9 is about 2.5 mm longer on 24 mm tape, 40.5 mm. Longer names are the length they were. The QR, the link and the code have not changed.',
  ],
}

export default note
