import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7373',
  date: '2026-11-15',
  title: 'Box labels: a shorter strip, with the link on two lines',
  kind: 'feature',
  highlights: [
    'A tape label no longer prints Scan for what is inside. The strip carries the QR, the box’s name and the link.',
    'The link prints on two lines, PRTS.CO/B/ and then the box’s code, so the strip ends where the name ends. A label for G81 on 24 mm tape uses about 42 mm where it used 51, and G1 about 38.',
    'A run of 455 strips uses about 19 metres of tape where it used about 23. Blank stickers and their preview print the same shorter strip.',
    'The QR, the link and the code are what they were, so a label already on a box scans and types as before. The test strip is unchanged.',
  ],
}

export default note
