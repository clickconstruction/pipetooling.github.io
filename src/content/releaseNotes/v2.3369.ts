import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3369',
  date: '2026-09-12',
  title: 'Sent bids get their labor hours from the book',
  kind: 'feature',
  highlights: [
    'When a bid with a count sheet is sent, its labor rows are created from the book right then — the same rows the Labor tab would have made — so the estimate carries hours without anyone opening Labor. Rows the book cannot answer wait in the Labor tab’s queue as before.',
    'Every sent bid with a count sheet was back-filled. Nothing a person typed was touched.',
  ],
}

export default note
