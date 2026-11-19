import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7870',
  date: '2026-11-18',
  title: 'Time: the row waits before it counts',
  kind: 'fix',
  highlights: [
    'When you tap Time, the row no longer says for an instant that the archive has no older photo.',
    'The row says it is looking until it has looked.',
    'The count of older photos shows once, when every date is in. It used to tick down as the dates came.',
  ],
}

export default note
