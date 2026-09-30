import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4266',
  date: '2026-09-30',
  title: 'Archive from board is always in the Edit Bid footer, and a greyed press says why',
  kind: 'feature',
  highlights: [
    'The Archive from board button no longer disappears from a bid that cannot be archived. It stays beside Delete bid, greyed, and pressing it tells you the reason and the door: a sent bid is already off the working board (mark it Lost if it is dead), a Won, Lost or Started bid left when its outcome was set, and a bid that is not yours names who can archive it.',
    'On a bid that is already archived the same button reads Put back on board and returns it to Unsent / Working, without a trip through Bid Board → Archived.',
    'The rule itself is unchanged: only an unsent bid with no outcome can be archived, by its estimator, its account man or a dev. The reason is also the hover text on a desktop, so a mouse user reads it before pressing.',
  ],
}

export default note
