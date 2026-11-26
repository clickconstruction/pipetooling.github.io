import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8624',
  date: '2026-11-26',
  title: 'Clock In and Clock Out: the press stays grey until you say what you did',
  kind: 'fix',
  highlights: [
    'On the clock-in sheet, Complete Clock In is grey while the plan box is empty, and a line under the box reads Say what you mean to get done today, then Complete Clock In. The press turns orange as you type.',
    'Before, the press looked ready, and a tap with the box empty only showed a short message that soon went.',
    'The clock-out review’s press does the same, with its own line: Say what you worked on today, then Complete clock out.',
  ],
}

export default note
