import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8637',
  date: '2026-11-26',
  title: 'Clock out: Your day starts at the minute you clocked in',
  kind: 'fix',
  highlights: [
    'On the Clock out sheet, the strip under Your day could start a few minutes before you clocked in. A clock in at 10:22 read 10:20.',
    'The app knows a bid was in front only to the nearest five minutes. When that five minutes holds your clock in, the strip now starts at the clock in.',
    'A day that is already clocked out ends at the clock out in the same way. The sizes on the rows do not change.',
  ],
}

export default note
