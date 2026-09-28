import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3993',
  date: '2026-09-28',
  title: 'Schedule: adding a job to several cells at once has tests',
  kind: 'fix',
  highlights: [
    'Adding one job to several people and days in one go writes an 8-to-4 block on each cell and skips anyone already busy in that window. Those writes now have automated checks behind them. Nothing on the screen changed.',
  ],
}

export default note
