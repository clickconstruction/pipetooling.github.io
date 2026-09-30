import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4272',
  date: '2026-09-30',
  title: 'The bid list on the workflow tabs is grouped the way the Bid Board is',
  kind: 'feature',
  highlights: [
    'On Counts, Takeoffs, Labor, Pricing, Cover Letter, Submittals, RFI, Change Order and Lien Release, the bid list you pick from now sits under the Bid Board\'s own headings, in the board\'s order, each with its count: Unsent / Working Bids, Not yet won or lost, Won, Started or Complete, Lost. Bids put away from the working board sit last under Archived (Unsent/Working).',
    'Press a heading to fold or open its group. Lost and Archived start folded; the working groups start open. The app remembers your folds on this device, the same way it remembers the sort choice, and every workflow tab shares them.',
    'Typing in the search box opens every group and hides the empty ones, so a bid you search for is never behind a fold. Clear the box and the folds come back.',
    'The sort buttons still work, inside each group: Bid # ↓ keeps the highest number first within Unsent, within Not yet won or lost, and so on. The headings never move.',
  ],
}

export default note
