import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8549',
  date: '2026-11-24',
  title: 'Final demand letter: the amount box drops its small Pay online label',
  kind: 'fix',
  highlights: [
    'The pay code in the letter’s amount box no longer has a small Pay online label beside it.',
    'The code, Scan to pay and the written-out address stay.',
    'Where the words sit under the code, as in the Settings preview and on a phone, the box is one line shorter.',
    'The PDF follows. Its box keeps its height, which the code sets, and the letter is still signed on page 1.',
  ],
}

export default note
