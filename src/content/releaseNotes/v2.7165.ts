import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7165',
  date: '2026-11-13',
  title: 'Materials: old prices checked one at a time, and the end of the list',
  kind: 'feature',
  highlights: [
    'A press on Worth now shows three chips: No price, An old price and Left out. Each lists its rows and shows its count.',
    'Under An old price, Check old prices one at a time opens the window on each row with the price it reads now. It offers only a bill newer than that price, or you type today’s price.',
    'When no row is waiting on a price the list says so and leads you to the old prices.',
    'Left out lists the rows set aside as not a part. Open one and press Bring back to price it after all.',
  ],
}

export default note
