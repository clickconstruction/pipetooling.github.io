import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2711',
  date: '2026-09-03',
  title: 'Job Summary — Timeline: how many jobs are running at once',
  kind: 'feature',
  highlights: [
    'Jobs → Job Summary has a third View, Timeline: a chart of how many jobs were running on each day of the window, stacked by working / billed / paid, with the 7-day average, the peak, and today marked. Hover a day for its split; click it for that day\'s session notes.',
    'Tiles above it: running today, average per day, peak and when, jobs in the window (finished vs. open), and the median run length. Open "The N jobs behind this curve" to see every job as a bar from its first running day to its last.',
    'Two definitions of running, one click apart: first → last work (with a gap setting so a paused job isn\'t counted while nobody is on it) or Working → Billed from the status history.',
  ],
}

export default note
