import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7430',
  date: '2026-11-15',
  title: 'Lien desk: a closed month is one line, and this notice’s total sits at the foot of its column',
  kind: 'feature',
  highlights: [
    'In Months on this job, a month whose window has closed takes one line instead of two: the month with its hours, then the closed date, who noted it and what it means. Four closed months take about half the height they did, so the months that can still go out stand out.',
    'The total for this notice moved from the top of its column to the foot, under the ticks that make it. It shows the claim, how many months are ticked and Preview ›, with the months it names beside it. The column keeps its name on top.',
    'Where the pane is too narrow for the whole line, the words every missed month repeats are cut short with … and the whole sentence shows when you point at it. Note it as missed always stays in view. On a phone the row wraps as before, so nothing is cut.',
  ],
}

export default note
