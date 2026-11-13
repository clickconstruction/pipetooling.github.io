import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7096',
  date: '2026-11-12',
  title: 'Older release notes use made-up names in their examples',
  kind: 'infra',
  highlights: [
    'Sixty older release notes quoted a customer, builder, owner, job name, street or email that read like a real one. They now use made-up ones.',
    'Only the names changed. What each note says shipped reads as before.',
  ],
}

export default note
