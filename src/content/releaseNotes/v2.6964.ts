import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6964',
  date: '2026-11-11',
  title: 'The Bridge keeps what the owner sets: the floor, the typed cash and the accounts left out',
  kind: 'fix',
  highlights: [
    'On the Bridge, behind Money, the owner can now set the Floor and it stays set. Before, only a developer’s account could save it.',
    'An account the owner leaves out of cash on hand now stays left out on the next visit, and the Monday email leaves it out too.',
    'Cash on hand today, the figure typed when the bank cannot be read, saves for the owner as well.',
  ],
}

export default note
