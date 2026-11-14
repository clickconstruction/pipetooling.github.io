import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7215',
  date: '2026-11-13',
  title: 'Lien affidavit: the notice record says whose total a notice total is',
  kind: 'fix',
  highlights: [
    'A notice that covered several jobs at one property now reads "The notice claimed $4,180.00 in all, $1,200.00 of it for this job" on the notice record. It no longer reads as if the total were this paper\'s claim.',
    'A page with such a notice adds one line near the top. It says the total is what the mailed notice claimed, and that an affidavit claims its own job\'s amount.',
    'No affidavit changed. The notice record is still a page nobody files.',
  ],
}

export default note
