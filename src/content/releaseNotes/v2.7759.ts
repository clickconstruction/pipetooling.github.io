import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7759',
  date: '2026-11-18',
  title: 'Bids: the book-match line and a row’s kind and tags are their own pieces',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, two small parts at the Pricing grid moved out of the big Pricing file: the line that names the price book and fills matching rows, and the kind and tags under a row’s name.',
    'Each has its own tests now, and so do the rules for adding and removing a tag.',
    'Nothing changes on screen.',
  ],
}

export default note
