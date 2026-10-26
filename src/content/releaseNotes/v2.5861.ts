import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5861',
  date: '2026-10-25',
  title: 'The Bridge: honest words on the Market card and the week card',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The Market card says "bids opened", not "bids invited" — the count is every bid created in the window, drafts included, and the old word claimed more.',
    'A week card\'s job list is captioned "earned, by job": the lines sum to what the field earned, while the card\'s head is contribution (earned less field wages).',
  ],
}

export default note
