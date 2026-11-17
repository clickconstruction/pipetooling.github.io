import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7651',
  date: '2026-11-17',
  title: 'HR files: an agent reading a file is told every part of it and how to open each',
  kind: 'feature',
  highlights: [
    'When an agent opens a person\'s HR file through the dev seat, the first answer now lists every part of the file with its whole count: the entries, the evidence and its files, the documents, the papers, the matter and the rest.',
    'The same answer carries the reading rules: start with the file\'s own notes, open a counsel-only item only on the owner\'s word for it, write nothing, keep the file private.',
    'An agent ends its read with a receipt against those counts, so what it did not open is said and not guessed.',
    'Finding a person by full name now works when the roster holds a first name alone.',
  ],
}

export default note
