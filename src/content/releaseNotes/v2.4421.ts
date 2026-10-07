import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4421',
  date: '2026-10-02',
  title: 'Bids: the day to call again shows on the Bid Board and in Edit Bid',
  kind: 'feature',
  highlights: [
    'A sent bid with a day to call again wears a small chip on the Bid Board and on the By builder card: blue while the day is ahead, amber on the day, red after it.',
    'Edit Bid shows the day under Last Contact. Set a day… or Change… moves it with no call, and Log contact… can set it with the call.',
    'A bid parked on a day still ahead is left alone by the old lenses: Waiting to hear reads it as caught up, and By builder and By status do not paint it red.',
  ],
}

export default note
