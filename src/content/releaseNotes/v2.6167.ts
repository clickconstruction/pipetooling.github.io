import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6167',
  date: '2026-10-30',
  title: 'One New Bid on a phone: an estimator’s Bids page no longer repeats the header’s Bid press',
  kind: 'fix',
  highlights: [
    'An estimator has a blue Bid button in the app header on every page. On a phone the Bids page drew its own New Bid a thumb under it. The page’s copy is gone on a phone; the header’s Bid is the one press.',
    'On a desk nothing moves: the page keeps New Bid at the right of its tab row.',
    'Everyone else has no Bid in the header, so their Bids page keeps New Bid on a phone as before.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
