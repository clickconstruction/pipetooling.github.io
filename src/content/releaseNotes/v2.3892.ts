import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3892',
  date: '2026-09-27',
  title: 'Quickfill: section colours follow each section’s own rhythm',
  kind: 'feature',
  highlights: [
    'Quickfill’s section colours now follow each section’s own rhythm: green until its next look is due, yellow the day it is, red after. A section you check weekly stays green for the week.',
    'A section marked fewer than three times keeps the old rule: green for 12 hours, yellow to 30, red after.',
    'The phone’s list already worked this way, so the computer and the phone now agree on what needs a look.',
  ],
}

export default note
