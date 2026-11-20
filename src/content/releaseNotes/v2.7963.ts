import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7963',
  date: '2026-11-19',
  title: 'Trips: join a trip with the next',
  kind: 'feature',
  highlights: [
    'Sometimes two trips are really one. An open trip now has Join with the next beside Split in two. It is also how you take a split back.',
    'The window shows both trips and the one trip they become before you press Join into one trip.',
    'The open trip keeps its number and its words. Everyone and every day from both trips are on it. No clock row, bill or cost changes.',
    'The trip that went waits under Deleted trips, marked as joined. It has no Put back, since its days are on the joined trip.',
  ],
}

export default note
