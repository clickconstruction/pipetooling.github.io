import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3459',
  date: '2026-09-14',
  title: 'Pipeline: the Progress & payment cell stops repeating itself',
  kind: 'fix',
  highlights: [
    'The line under the bar no longer names the stage or the crew — the lit chip above it already says Top Out, and Crew & Dates lists the people. It now reads just when and what percent: “on site Jul 22 · 90% set Aug 7”. Hover the bar for the whole sentence.',
    'The live stage chip drops the crew’s name for the same reason; it still says “today” while they are clocked in there.',
    'Send back and Collections sit side by side under the cell instead of stacked.',
    '“This bill: $X paid · $Y left” only appears when the job has more than one bill out; with one bill the Paid and Billed rows already say it.',
  ],
}

export default note
