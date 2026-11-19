import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7917',
  date: '2026-11-19',
  title: 'Lien desk: the copies to mail print on one side of the paper',
  kind: 'fix',
  highlights: [
    'Each envelope’s pages print in order, and an envelope is often three pages. A two-sided print would put the next envelope’s letter on the back of a stamped page.',
    'The line under Print the copies to mail now says Print on one side of the paper. The PDF asks the print window for one side too, and for each page at its own size.',
  ],
}

export default note
