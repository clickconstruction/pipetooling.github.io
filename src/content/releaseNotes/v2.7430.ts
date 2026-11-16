import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7430',
  date: '2026-11-15',
  title: 'Lien desk: a closed month is one line, and this notice’s total sits at the foot of its column',
  kind: 'feature',
  highlights: [
    'In Months on this job, a month whose window has closed takes one line instead of two: the month with its hours, then the closed date and who noted it. Four closed months take about half the height they did, so the months that can still go out stand out.',
    'What a missed window costs is said once, in a line under the grid that names the missed months: lien right gone · the money still rides, or that a late notice can still go and by when. It was repeated on every closed row.',
    'The total for this notice moved from the top of its column to the foot, under the ticks that make it. It shows the claim, how many months are ticked and Preview ›, with the months it names beside it. The column keeps its name on top.',
    'Note it as missed always stays in view on a narrow pane, and on a phone the row wraps as before, so nothing is cut.',
  ],
}

export default note
