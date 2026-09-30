import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4266',
  date: '2026-09-30',
  title: 'Archive from board is always in the Edit Bid footer, and a greyed press says why',
  kind: 'feature',
  highlights: [
    'The Archive from board button no longer disappears from a bid that cannot be archived. It stays beside Delete bid, greyed, and pressing it says what to change so you can archive it: clear Bid Date Sent on a sent bid (or set Win / Loss to Lost if the bid is dead), set Win / Loss back to Open on a Won, Lost or Started bid, or set yourself as its Estimator or Account Man when the bid is not yours. When it is not yours it names the estimator and account man to ask.',
    'On a bid that is already archived the same button reads Put back on board and returns it to Unsent / Working, without a trip through Bid Board → Archived.',
    'The rule itself is unchanged: only an unsent bid with no outcome can be archived, by its estimator, its account man or a dev. The reason is also the hover text on a desktop, so a mouse user reads it before pressing.',
  ],
}

export default note
