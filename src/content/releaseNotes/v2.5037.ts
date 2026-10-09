import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5037',
  date: '2026-10-09',
  title: 'GC mode: the presses behind the submittal register',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'GC mode can keep a trade’s submittals: each one gets its number and the work it holds, and each time it came in, went to the architect and was answered is kept.',
    'A trade’s last submittal keeps its promise to send them. Nothing on screen uses this yet; the Submittals window comes next.',
  ],
}

export default note
