import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6477',
  date: '2026-11-03',
  title: 'On a laptop, the reply box waits as one row',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a short window, the reply box at the foot of a thread is one row: the kinds and a one-line box.',
    'Press into the box, or pick a kind, and it opens whole. It folds back after the message goes.',
    'Words or files waiting to go keep it open, and a job’s reply box is never folded.',
  ],
}

export default note
