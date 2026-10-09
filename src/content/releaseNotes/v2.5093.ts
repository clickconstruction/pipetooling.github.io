import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5093',
  date: '2026-10-09',
  title: 'Lien desk: the claim counts a payment with no bill picked',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A lien notice now counts a payment put on the job with no bill picked, the way the board already does. It pays the work not yet billed first, then the oldest bill.',
    'So a notice never claims money the board counts as paid. Job 273 claims $16,685, not $17,585. The Deadlines, the Dashboard’s lien reminder, Put a GC on notice and the bills under the claim read the same.',
  ],
}

export default note
