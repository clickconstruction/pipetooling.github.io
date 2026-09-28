import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3945',
  date: '2026-09-27',
  title: 'Bids → Pricing: the quote desk is its own piece',
  kind: 'fix',
  highlights: [
    'The price-request chip on the Pricing tab and the windows behind it — quotes, requests to supply houses, the robot — now live in their own piece of the app, with tests for when the chip shows what. Nothing on screen changed.',
  ],
}

export default note
