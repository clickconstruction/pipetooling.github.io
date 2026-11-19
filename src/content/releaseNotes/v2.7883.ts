import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7883',
  date: '2026-11-18',
  title: 'Lien desk: Mail proof complete waits for the mailed day',
  kind: 'fix',
  highlights: [
    'A filed lien with a file on each copy read Mail proof complete, and each copy read Mailed, while its mailed day was not recorded and its serve-by day was still counting. A file on a copy no longer says the copy was mailed. The day does.',
    'Until the day is recorded each copy reads Not mailed yet and keeps its file. With every file in, the chip reads Mailed day not recorded, and the Next line says to record the day the copies were mailed.',
    'A copy that keeps a number or a file with no day has a new press, Record the mailing. It opens the lien’s card in Filed liens: copies to mail, at its Mailed box.',
    'The chip reads Mail proof complete only when nothing is left to add: the files, the mailed day, each mail number and each receipt. A mailed copy with no number reads Mail number missing.',
  ],
}

export default note
