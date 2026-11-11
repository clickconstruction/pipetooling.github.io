import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6935',
  date: '2026-11-11',
  title: 'An agent on the dev seat can open a large HR case whole',
  kind: 'fix',
  highlights: [
    'On a very large HR file, the two reads an agent uses to open a case came back cut off partway. The case brief lost its last parts, and the file’s lines stopped in the middle of a sentence.',
    'Both reads now fit in one answer. When a file is too long they shorten the longest parts first and say which parts were shortened and how to read each one whole.',
    'An agent can ask for the file with short lines, and can read a long Timeline a stretch of months at a time.',
    'The count of HR entries is now right on a file with more than 200 of them. It used to stop at 200.',
  ],
}

export default note
