import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8745',
  date: '2026-11-27',
  title: 'A group of pins on a map says what it holds',
  kind: 'fix',
  highlights: [
    'On the permits map and the Jobs map, a group of pins named itself “N bids here”. They are permits and jobs.',
    'A group now reads “N permits here” on the permits map and “N jobs here” on the Jobs map. The Bid Board’s map still says bids.',
    'That name is what you see when you hover over a group, and what a screen reader says.',
  ],
}

export default note
