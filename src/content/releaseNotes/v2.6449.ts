import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6449',
  date: '2026-11-03',
  title: 'Job photos: the window loads when you open it, so the app’s first load is lighter',
  kind: 'fix',
  highlights: [
    'The Photos line on the Job Mode card and the Photos door on the job window’s Documents tab now fetch the Job photos window when you press them, not when the app first loads.',
    'The press answers right away with Opening the job’s photos… while the window arrives. On a phone with no signal the window still opens, since the app keeps it ready.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helpers', 'subcontractor'],
}

export default note
