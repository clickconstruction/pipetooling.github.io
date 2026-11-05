import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6530',
  date: '2026-11-04',
  title: 'A person on the roster always has their users row, and re-inviting someone keeps them one person',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The database refuses a roster record made or unlinked from the app without its users row, so nobody can be added half-way again.',
    'A person who has a roster record can be archived but never deleted underneath it.',
    'Re-sending an invite that was never accepted keeps the same person: the fresh invite lands on their existing row instead of making a second one.',
  ],
}

export default note
