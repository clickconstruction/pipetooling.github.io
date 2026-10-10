import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5212',
  date: '2026-10-10',
  title: 'GC mode: a ring on each board row shows how far the job has come',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Each GC project on the board has a ring that fills as the job gets through its stage.',
    'Point at the ring, or press it, to see what is done and what is left.',
    'A ring shows only to the people who can read everything it counts. An empty gray ring is still reading.',
  ],
}

export default note
