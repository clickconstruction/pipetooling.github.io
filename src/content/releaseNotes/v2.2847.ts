import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2847',
  date: '2026-09-05',
  title: 'Labor tab: no more "Add fixtures first" on bids that have fixtures',
  kind: 'fix',
  highlights: [
    'Picking a bid on Bids → Labor now shows its HOURS table straight away. Before, every bid with versions said "Add fixtures in the Counts tab first" until you visited another tab and came back — the counts were never gone.',
    'While a bid is still loading, Labor shows a short loading card instead of an empty list, the same way Pricing does.',
    'Opening Labor or Takeoffs on a bid with no fixtures no longer creates a labor-cost record behind the scenes; one is created when you first add fixtures or a purchase order.',
  ],
}

export default note
