import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8750',
  date: '2026-11-27',
  title: 'A red confirm window opens on Cancel',
  kind: 'fix',
  highlights: [
    'When a window asks before a delete or a remove, its button is red. It used to open with that red button ready, so a stray Enter did the delete.',
    'A red window now opens on Cancel. Enter keeps what would be lost. To go ahead, press the red button.',
    'A window with a blue button opens as it did, and Escape still cancels every window.',
  ],
}

export default note
