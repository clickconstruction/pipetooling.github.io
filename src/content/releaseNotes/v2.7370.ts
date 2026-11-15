import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7370',
  date: '2026-11-15',
  title: 'Scores: a sent bid is judged by the labor it went out with',
  kind: 'fix',
  highlights: [
    'When a bid is priced, the app now keeps how many of its labor rows had hours, beside the margin it keeps.',
    'A bid that went out with no labor in its cost stays unscored, even when the hours are filled in afterwards. Before, filling them in later made it read as scored on a cost that had no labor in it.',
    'Bids priced before today are judged as they were.',
  ],
}

export default note
