import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7010',
  date: '2026-11-12',
  title: 'Lien affidavit: the county blank at the top prints plain',
  kind: 'fix',
  highlights: [
    'The blank after COUNTY OF at the top of a lien affidavit no longer reads (where signed) beside it.',
    'The help sheet that prints in front of the paper says which county to write there: the county where it is signed.',
    'A paper drafted earlier prints without the words too. Nothing sworn on the paper changes.',
  ],
}

export default note
