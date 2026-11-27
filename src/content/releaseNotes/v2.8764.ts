import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8764',
  date: '2026-11-27',
  title: 'Bids: the price book’s offer to update a bid has a piece of its own, with tests',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the offer the price book makes after an entry is saved, to carry that edit into the open bid, moved out of the big Pricing file into a small piece of its own.',
    'Both kinds of offer, each press, what each writes and every way an offer goes away were pinned by tests on the screen before the move.',
    'Nothing changes on screen.',
  ],
}

export default note
