import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8216',
  date: '2026-11-21',
  title: 'Bids: what the three breakdown cards are handed has its own tests',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the numbers the Pricing tab hands its three breakdown cards moved out of the big Pricing file into a small piece of their own.',
    'That piece has its own tests now, with each card’s dollars checked from a row to its total.',
    'Nothing changes on screen.',
  ],
}

export default note
