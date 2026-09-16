import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3499',
  date: '2026-09-16',
  title: 'Housekeeping after the tip change',
  kind: 'fix',
  highlights: [
    'Database types regenerated now that the tip change is live, and the note it writes on the payment falls back to its standard wording again. Nothing changes on screen.',
  ],
}

export default note
