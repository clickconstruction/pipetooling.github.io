import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2807',
  date: '2026-09-05',
  title: 'Timeline — walk the chart back with an "As of" slider',
  kind: 'feature',
  highlights: [
    'On Jobs → Job Summary → Timeline, a new ⏮ As of chip reveals a slider that rewinds the chart a day at a time: the window clips at that day, every job is colored as it stood then, and the days after fade to a dashed outline so you can see what was coming.',
    'Week chips jump 1 to 8 weeks back; ▶ Play walks forward to today so you can watch bills go out and get paid.',
    'A strip under the chart counts what changed since that day — jobs opened, billed, paid, and how many open then are still open now. The tiles recompute to that day too.',
    'Works on both the Daily and Weekly charts, entirely from the status moves already recorded — no refetch.',
  ],
}

export default note
