import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4253',
  date: '2026-09-30',
  title: 'Procurement log: its date boxes read a date with the shared rules',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The procurement log’s Ordered, Expected and Delivered boxes now use the same date-reading rules as the other date boxes in the app, where they used to carry a copy of their own. Nothing changes on screen: a typed date still saves when you press Enter or leave the box, a picked date saves at once, and a half-typed date is not saved.',
  ],
}

export default note
