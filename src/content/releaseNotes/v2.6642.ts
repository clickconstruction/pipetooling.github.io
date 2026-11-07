import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6642',
  date: '2026-11-07',
  title: "A document's history from the dev seat stays readable when its lines are long",
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    "Asking the dev seat for the difference between two versions of a long narrative could come back cut off mid-sentence, because whole paragraphs counted as single lines. The difference now also stops at a size limit, so the reply always arrives whole.",
    'When the difference is longer than that, the reply says so, and the sections can be read one at a time.',
  ],
}

export default note
