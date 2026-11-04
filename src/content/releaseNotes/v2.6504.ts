import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6504',
  date: '2026-11-04',
  title: 'A press anywhere else in a thread folds the reply box',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Press anywhere in a thread that is not the reply box, and the box folds to one row, on any screen size.',
    'The words you typed stay in the row. Press the row, or a kind, and the box opens whole with your words.',
    'A press on Attach, a quick reply, Tie to or Send never folds it, and files waiting on the message keep it open.',
  ],
}

export default note
