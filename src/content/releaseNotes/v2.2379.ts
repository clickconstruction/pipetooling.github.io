import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2379',
  date: '2026-08-27',
  title: 'Workbench: proposals beside prices, and every money cell solves',
  kind: 'feature',
  highlights: [
    'Solver results no longer overwrite the price field: each proposal appears as a purple price with an arrow to the LEFT of the row’s current price, which stays visible until you Apply or Discard.',
    'Click any purple proposal to drop just that row from the solve — it flips red with an ✕ and Apply leaves its price alone; click again to bring it back. Clicked-off rows stay that way while you keep tuning the margin.',
    'Revenue, Profit, and Margin are inputs now: type in whichever number you’re negotiating in and the sale price/unit follows as you type, saving on Enter exactly like a typed price.',
    'The sale price field sheds its lone box — all four money cells share the same quiet look.',
  ],
}

export default note
