import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6167',
  date: '2026-10-30',
  title: 'New Bid lives in the app header, the way the estimator’s Bid press always did',
  kind: 'feature',
  highlights: [
    'Everyone who can make a bid now has the blue Bid button in the app header, beside the other presses, on every page. Before, only estimators had it.',
    'On a phone or a narrow window the Bids page no longer draws its own New Bid on a row of its own under the trades. The header’s Bid is the one press. On a wide screen the page keeps New Bid at the right of its tab row.',
    'The gap between the two tab rows and the gap under the second row are closed up on narrow windows.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'superintendent'],
}

export default note
