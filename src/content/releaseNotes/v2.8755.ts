import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8755',
  date: '2026-11-27',
  title: 'Bids: the price book’s three forms keep their state in a piece of their own',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, what the price book’s three windows remember, the book’s name, the delete check and an entry’s prices, moved out of the big Pricing file into a small piece of its own.',
    'Every door into those windows, what each holds and what each Save writes was pinned by tests on the screen before the move.',
    'Nothing changes on screen.',
  ],
}

export default note
