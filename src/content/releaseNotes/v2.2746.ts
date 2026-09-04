import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2746',
  date: '2026-09-04',
  title: 'Timeline — a weekly roll-up',
  kind: 'feature',
  highlights: [
    'Jobs → Job Summary → Timeline has a Daily | Weekly switch. Weekly stacks each week as jobs carried over from before (the floor) and jobs that started that week (on top), so the daily spikes average out into one honest number per week.',
    'The tiles follow: running this week, average per week, and the peak week. Hover a week for its split; the bars panel stays day-by-day.',
  ],
}

export default note
