import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2370',
  date: '2026-08-26',
  title: 'Cover letter alternates on one page',
  kind: 'feature',
  highlights: [
    'Alternates now list right under the proposed amount — "Alternate 1: $62,024.11 (reduced $5,287)" — instead of printing a second full letter per alternate.',
    'Click the dashed text on the preview to rename an alternate or add a note in customer language; internal names on the Pricing tab stay put, and Reset to auto brings the automatic wording back.',
    'A packet that is all alternates now leads with its ★ price instead of proposing $0.00.',
    'Prefer the old document? Flip "Alternates in the letter" to Separate pages — your choice sticks on this device.',
  ],
}

export default note
