import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3915',
  date: '2026-09-27',
  title: 'Schedule: the rules behind copies, drags and days off have tests',
  kind: 'fix',
  highlights: [
    'Copying a block to another person, dropping a block on a day, and marking someone as not coming in now each have automated checks behind them, so a later change to the Schedule cannot quietly break them. Nothing on the screen changed.',
  ],
}

export default note
