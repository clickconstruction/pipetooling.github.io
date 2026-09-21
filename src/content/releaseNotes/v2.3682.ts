import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3682',
  date: '2026-09-21',
  title: 'Lien desk: correct the claim by hand, and it carries until you clear it',
  kind: 'feature',
  highlights: [
    'When a bill is in dispute, click the claim amount on the notice and it becomes a box: type what the notice should claim, say why, and tick whether it carries. The line under it says the difference from the app’s balance; the rest stays on the books for Collections.',
    'The correction is an amount off, not a snapshot. When the balance moves, it rides on top; every later notice shows it is carrying the correction and asks “still true?” before it goes, and the affidavit claims the corrected figure too.',
    'The figure prints in yellow like every typed value, the card says who set it and why, and the leader sees the same on their card. Over the balance it turns red and only the leader can approve it — never a standing rule or the spoken word.',
    'Say it per month is there for a month that genuinely has its own figure; the paper prints the split only when a person typed it.',
  ],
}

export default note
