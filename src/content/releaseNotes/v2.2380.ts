import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2380',
  date: '2026-08-27',
  title: 'Workbench: the slider solves as you drag, and the breakdown jumps',
  kind: 'feature',
  highlights: [
    'The margin slider re-prices live on every step of the drag — totals, ghosts, and the landing chip track the thumb instead of waiting for release — and carries markup reference ticks: 2 at 50%, 3 at 66%, 4 at 75%, 5 at 80%.',
    'The Margin breakdown is tighter, and three jump chips — # Counts, 📐 Takeoffs, 🛠 Labor — take you straight to the tab a number comes from, bid in hand.',
    'Quieter words: "16 drafts — saved only when you Apply", "70% on 16 costed rows → bid is $62,191 · 83%", and the no-cost banner only appears while a solve is pending: "23/39 have no cost: their $26,156.17 is unaffected".',
  ],
}

export default note
