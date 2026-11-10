import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6862',
  date: '2026-11-10',
  title: 'Box labels: the QR now opens the box on an iPhone',
  kind: 'fix',
  highlights: [
    'A box label\u2019s QR used to open a web search on an iPhone. It now opens the box.',
    'The fix is in every place the code is made: the label, the manifest, the CSV and Copy the label code.',
    'A label printed before this still opens a search on an iPhone. Print it again, or type its code with Scan a label.',
  ],
}

export default note
