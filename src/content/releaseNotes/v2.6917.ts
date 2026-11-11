import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6917',
  date: '2026-11-10',
  title: 'Permits: the word under a name knows both calling decks',
  kind: 'fix',
  highlights: [
    'The word under who pulled a permit says on the deck when we already have an open lead of that name. It now looks on the Customers deck as well as Jobs to GC.',
    'A general contractor you pursued now reads on the deck on their next permit, where it would have read new name.',
    'The line beside a bid count says on a calling deck.',
  ],
}

export default note
