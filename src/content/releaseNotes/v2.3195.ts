import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3195',
  date: '2026-09-09',
  title: 'Price requests on a bid: supply house, date and the request link — nothing else',
  kind: 'feature',
  highlights: [
    'The Price requests table in Edit Bid is down to three things: the supply house, when you requested it, and a link to the request you sent. The Quote column is gone, and so is the quote-link box that was inviting prices to be typed into it.',
    'A pasted request shows as the address itself, clickable, with the whole link on hover. Requests the app sent keep their Vendor page link.',
    'Quotes still live where they are priced: plug them in or open them from the desk on Pricing.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
