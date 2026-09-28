import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3907',
  date: '2026-09-27',
  title: 'Project money: the totals, margin and balance come from one tested place',
  kind: 'fix',
  highlights: [
    'A project’s Workflow page and its Forecast each worked out what was projected, what was spent, the margin and the balance with their own copy of the math. Both now read one module, so the two screens cannot drift apart.',
    'The Projections & Ledger table on the Workflow page — which line item sits beside which projection, and the Projections, Ledger and Left figures — has tests, and so does pasting line items from a spreadsheet.',
    'Nothing on screen changes; every figure reads as before.',
  ],
}

export default note
