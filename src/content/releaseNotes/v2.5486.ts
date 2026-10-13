import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5486',
  date: '2026-10-13',
  title: 'Messages: the code reads the new kinds of contact through the database’s own types',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The four new kinds of contact are checked against the database’s own description now, not a stand-in.',
    'Opening a customer’s messages from their name is checked the same way. Nothing changes on screen.',
  ],
}

export default note
