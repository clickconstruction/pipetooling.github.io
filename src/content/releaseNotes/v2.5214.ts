import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5214',
  date: '2026-10-11',
  title: 'GC mode: how each job’s stage is going, on its card',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Each GC project card now says how its stage is going under its name: on track, watch or behind, and why.',
    'It shows the stage’s calendar, a tile for each trade, and the one thing to do next, which opens that window.',
    'It reads the same as the ring on the board, and a dev can set a missing start date right there.',
  ],
}

export default note
