import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4587',
  date: '2026-10-05',
  title: 'Procurement log: To order shows orders, not single lines',
  kind: 'feature',
  highlights: [
    'To order now groups parts into orders. What you can order is one line per order-by date, soonest first. A date within three days is amber.',
    'Press "Mark ordered…" on an order to mark all of its parts with one date and one PO. Tick some parts first to mark only those.',
    'Parts on order and on site are grouped by PO. Parts the GC sent back show what they wrote, with "Pick another product" beside it.',
    'Parts still waiting on the GC fold to one line per fixture, with "Their answer…" at the right. On a phone the log still shows a card per part.',
  ],
}

export default note
