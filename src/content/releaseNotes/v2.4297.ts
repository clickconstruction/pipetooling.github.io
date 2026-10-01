import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4297',
  date: '2026-10-01',
  title: 'Bids: mark a bid for a teammate, with a note',
  kind: 'feature',
  highlights: [
    'In an open bid, press For someone… after the title. Pick the estimator, the account man or anyone else in Bids, type what to look at, and press Mark for them. You can also send one notification to their phone.',
    'The bid shows on their lists with your first letter in a violet circle and your note on the row, even when Only my bids is on. Opening the bid shows the note under the title.',
    'They finish it with Done under the title, by tapping your letter on a list, or by holding the row. Not for me passes it back. Either way you see it on your own lists: not seen yet, seen, done.',
    'Only the two of you see it. While it is not done you can tap the letter and press Take it back.',
  ],
}

export default note
