import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7011',
  date: '2026-11-12',
  title: 'Printing: a page waits for its pictures, so a code never prints as an empty box',
  kind: 'fix',
  highlights: [
    'The codes on a lien help sheet could print as empty boxes. The page was sent to the printer before its pictures had loaded.',
    'A printed page now waits for its pictures first. A page with no picture prints at once, as before.',
    'A picture that never arrives does not hold the print: the page prints after three seconds without it.',
  ],
}

export default note
