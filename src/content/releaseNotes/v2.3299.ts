import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3299',
  date: '2026-09-11',
  title: 'Job Costs: the Budget card — link the bid, or type what you expect',
  kind: 'feature',
  highlights: [
    'The job’s Costs tab opens with a Budget card. With no bid linked it says plainly that Burn is reading an assumed budget (price × 65 %), lists the bids that could be this job’s — a bid whose value equals the job’s price, the same GC, the same address — and links one with a tap; or type hours, materials and subs and use that instead.',
    'Once a bid is linked, the card reads its estimate: which bid, whether the bid value matches the job price, when the estimate was taken and how complete it is; then one row per component — labor in hours first, materials, subs, other — with used against budget, the % done as a marker on the bar, and where each lands at today’s pace. A sentence says why the job is hot.',
    'Burn’s budget follows the card: ◆ from the bid or ✎ typed instead of the assumed margin. Refresh from bid re-takes the estimate as a visible change; Clear goes back to the assumption. Nothing links on its own.',
  ],
}

export default note
