import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4294',
  date: '2026-10-01',
  title: 'Edit Job → Bill: read the money by bill or by date',
  kind: 'feature',
  highlights: [
    'Two buttons at the right of the Bills and payments heading switch the list. By bill shows each bill with the payments that paid it. By date puts the bills and the payments on one line of dates, oldest first.',
    'In By date each payment says which bill it pays, and the last row says how much is still open today.',
    'The choice is remembered on this computer, like the folds on the Bid Board.',
  ],
}

export default note
