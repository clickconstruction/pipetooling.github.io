import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5275',
  date: '2026-10-12',
  title: 'Messages: By company reads a job that ended as declined or not carried',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A job whose customer declined now reads declined on By company, not not started.',
    'A job where we carried another quote reads not carried.',
  ],
}

export default note
