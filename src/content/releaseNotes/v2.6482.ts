import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6482',
  date: '2026-11-03',
  title: 'A thread’s messages keep their room on every screen',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On any wide window, the sort card sits whole at the right of the messages, not only on a laptop.',
    'On a tablet or a phone, the sort card folds to one row over the messages, and on a phone the reply box does too.',
    'The messages always keep a third of the window, and a long address no longer pushes an email past a phone’s edge.',
  ],
}

export default note
