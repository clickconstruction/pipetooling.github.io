import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7919',
  date: '2026-11-19',
  title: 'Dev seat: a lien filing’s replies say the copy to mail is the stamped scan',
  kind: 'fix',
  highlights: [
    'When an assistant records or checks a filed lien, its reply no longer says the app redraws the copy or tells you to mail a photocopy.',
    'It now says what Print the copies to mail does: the copy in the envelope is the clerk’s stamped scan, whatever the record says.',
    'Where the record and the paper differ on the claim, the property or the owner, it says the cover letter would be wrong and to leave the letter out.',
    'A filing recorded with no saved copy is named as held at the print until its stamped scan is added.',
  ],
}

export default note
