import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7739',
  date: '2026-11-18',
  title: 'Bids: the Pricing header chip and the loading panel are their own pieces',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, two small parts at the top of the Pricing tab moved out of the big Pricing file: the chip that says where quotes and price requests stand, and the panel shown while a bid’s prices load.',
    'Each has its own tests, with the chip’s colours and words checked in every state.',
    'Nothing changes on screen.',
  ],
}

export default note
