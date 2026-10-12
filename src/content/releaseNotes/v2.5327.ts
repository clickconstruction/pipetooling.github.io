import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5327',
  date: '2026-10-12',
  title: 'Messages: the threads read the database’s own shapes, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The code that reads people and their messages now follows the database’s own description of those tables, so a change there is caught before it ships.',
    'Nothing on screen changes.',
  ],
}

export default note
