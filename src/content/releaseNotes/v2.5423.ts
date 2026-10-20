import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5423',
  date: '2026-10-12',
  title: 'The code no longer carries a stale build cache',
  kind: 'infra',
  roles: ['dev'],
  highlights: ['A stale copy of a build cache no longer sits in the code.'],
}

export default note
