import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1964',
  date: '2026-08-21',
  title: 'Tasks get numbers inside their stage — 4.1, 4.2, 4.3',
  kind: 'feature',
  highlights: [
    'Every roadmap task now carries its stage-dot-position number on the Map clusters, the Plan rows, and the task card — "do 4.2 before 4.1" means the same thing everywhere.',
    'The Order stages dialog grew a ▸ per stage: expand it and drag the tasks into order — the top task is always N.1.',
  ],
}

export default note
