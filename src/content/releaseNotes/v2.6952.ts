import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6952',
  date: '2026-11-11',
  title: 'Lien affidavit: the county blank at the top says where signed',
  kind: 'fix',
  highlights: [
    'The blank after COUNTY OF at the top of a lien affidavit now reads (where signed) beside it.',
    'That blank is the county where the paper is signed in front of the notary. The property’s county is already printed in the second statement.',
    'The notary’s own county blank lower on the page is unchanged.',
  ],
}

export default note
