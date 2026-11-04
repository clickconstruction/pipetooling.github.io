import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6478',
  date: '2026-11-03',
  title: 'On a wide laptop, the sort card sits beside the messages',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a short window that is wide, the sort card over a thread moves to a column at the right of the messages.',
    'The card shows whole there, every way to sort it, while the messages keep the window’s full height.',
    'A narrower window keeps the one-row card over the messages.',
  ],
}

export default note
