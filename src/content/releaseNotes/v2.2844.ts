import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2844',
  date: '2026-09-05',
  title: 'Job Summary — first-look polish on the new views',
  kind: 'fix',
  highlights: [
    'Cycle: the chart fits your numbers instead of a fixed 45-day ceiling, and the 30-day line only draws when a month gets near it.',
    'Scatter: deep losses pin to a −50% floor (counted on the axis) so the middle of the plot keeps its room.',
    'Capacity: weeks with no approved field hours read "no hours" instead of 0%, the footnote counts them, and the first month label no longer collides with the next.',
    'Rework: an unbilled return whose job is still in progress is tagged "still open" in the pairs table. The Compare to caption now carries the year and only shows on views that compare.',
  ],
}

export default note
