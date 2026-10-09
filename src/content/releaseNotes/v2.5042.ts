import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5042',
  date: '2026-10-09',
  title: 'Sub portal: a sub’s note now reaches the dispatch group’s phones',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant'],
  highlights: [
    'When a sub leaves a note on their portal, the dispatch group now gets the push. That covers availability, a day off under a booking, work done, a progress note, and a declined or signed work order.',
    'The note always landed in the dispatch inbox. Only the push never went out.',
  ],
}

export default note
