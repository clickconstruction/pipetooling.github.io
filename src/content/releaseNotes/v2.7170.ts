import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7170',
  date: '2026-11-13',
  title: 'Bid Board: a bid sent on a Sunday counts in its own week',
  kind: 'fix',
  highlights: [
    'On the Bid Board, the Pulse and the weekly sent counts put a bid sent on a Sunday in the week before. They now put it in the week that Sunday starts.',
    'No bid sent since May has a Sunday send day, so no week on the board changes today.',
  ],
}

export default note
