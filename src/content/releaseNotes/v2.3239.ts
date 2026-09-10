import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3239',
  date: '2026-09-10',
  title: 'Pricing: what the bid is made of — fixtures, pipe, fittings',
  kind: 'feature',
  highlights: [
    'Under the Workbench strip, one bar splits the bid into fixtures, pipe footage, fittings, and other (allowances, travel). The header says it in your units — 59 fixtures · 2,448 ft of pipe · 357 fittings — and each bucket shows its margin in the strip’s green, amber and red.',
    'Flip it between share of revenue and share of cost. Where the two disagree is where the pricing posture lives: pipe at 22% of revenue but 30% of cost is under-priced against the fixtures.',
    'Hover a bucket for its revenue, cost, profit and margin and its three biggest rows; a row name jumps to the row. A bucket with revenue but no cost says so instead of claiming a margin.',
    'Fix: the robot’s envelope and the Audits card now price our rows the way the Workbench does, including typed prices. Before, a bid priced by typing showed $0 rows and the delta landed under “everything else”.',
  ],
}

export default note
