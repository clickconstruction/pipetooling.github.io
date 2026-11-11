import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6955',
  date: '2026-11-11',
  title: 'Lien affidavit: an amber line when a sworn month has no timely notice behind it',
  kind: 'feature',
  highlights: [
    'Under the affidavit’s gate list, an amber line now reads Ask the attorney before this is filed when the record raises a question about a notice.',
    'It names each month whose notice to the owner went after its date or is not on record, and each month with no copy to the original contractor on record.',
    'It is a flag and holds nothing. The paper still drafts, approves and prints, and the decision is your attorney’s.',
  ],
}

export default note
