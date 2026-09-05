import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2842',
  date: '2026-09-05',
  title: 'The Wednesday GC-review nudge now counts "Sent it" marks — it can finally go green',
  kind: 'fix',
  highlights: [
    'The Dashboard\'s "GC review is due" card counted only statements the app emailed. A week worked through the personal statement round — every statement sent by hand and marked Sent it ✓ — stayed amber at "0 statements sent" all week and kept telling the office to send each statement off, even though they already had.',
    'A GC now counts as sent this week when its statement went out any of the ways the app knows about: a Sent it ✓ mark, Send from the app… / Draft Message, or a scheduled send addressed to that GC. The card, the badge, the GC Review strip and the morning round email now agree.',
    '"Spoke with them · no statement" still never counts as a statement, and the office\'s own "All GCs" copies never did.',
  ],
}

export default note
