import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4402',
  date: '2026-10-02',
  title: 'Customer pages hold still behind a window too',
  kind: 'fix',
  highlights: [
    'The pages a customer, a sub or a GC opens from a link now hold still behind an open window. Before, only the pages you sign in to did.',
    'This covers the estimate page, the sub portal, the customer portal, the bid room and the submittal room.',
  ],
}

export default note
