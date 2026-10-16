import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5570',
  date: '2026-10-15',
  title: 'Messages: a tall card above the lines no longer hides the reply box',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When the Who has it card listed the whole office, it pushed the reply box under the bottom of the thread window, with nothing to scroll. The card now scrolls inside its own area, the lines keep a few rows, and Text, Email and Note stay in reach.',
  ],
}

export default note
