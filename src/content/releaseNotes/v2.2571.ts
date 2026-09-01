import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2571',
  date: '2026-09-01',
  title: 'Accounts Receivable, grouped by who you’d call',
  kind: 'feature',
  highlights: [
    'The Dashboard AR drill-down now opens on a Customers view — one row per customer with everything they owe, their open bills as a colored bar, and how long they’ve kept you waiting against their own usual pay speed.',
    '“Past their pace” vs “on pace” totals filter the list with a click, and on-pace customers fold into one quiet row — the list is only as long as the problem.',
    'Expanding a customer lists every bill with its line items already unfolded, plus their portal globe. The Bills button brings back the classic flat list.',
  ],
}

export default note
