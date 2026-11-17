import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7529',
  date: '2026-11-16',
  title: 'Lien calendar: the envelope mark reads Approved · to mail',
  kind: 'fix',
  highlights: [
    'On By date, the amber envelope mark was called In the mail. It is now called Approved · to mail, the same name the Lien desk gives a printed notice.',
    'The counts beside it read 2 to mail in place of 2 in the mail.',
    'The mark no longer says a printed notice is on its way. A print does not prove the envelope left.',
    'A job’s lien clock chip reads to mail and its days for a printed notice.',
  ],
}

export default note
