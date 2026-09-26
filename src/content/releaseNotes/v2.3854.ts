import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3854',
  date: '2026-09-26',
  title: 'Bids → Cover Letter: each GC version keeps its own price',
  kind: 'fix',
  highlights: [
    'On a bid split into GC versions, switching to another version and opening the Cover Letter could jump the pricing to the first version’s ★ — another GC’s price. The Cover Letter now lines up with the ★ of the version you are on, and keeps that version’s own pricing when it has no ★.',
    'A version with no pricing of its own no longer borrows another GC’s, so the Pricing tab stops showing other GCs’ price cards priced on its counts.',
  ],
}

export default note
