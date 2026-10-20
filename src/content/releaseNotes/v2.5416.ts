import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5416',
  date: '2026-10-12',
  title: 'Messages: a lead who texts the office keeps one thread until they book, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules for a lead are written. Someone who texts the office for work can be named a lead, and their thread stays whole.',
    'A lead lives in Messages. A Prospects row is made only when the office presses Add to Prospects.',
    'When a lead books, they become the customer and keep every line. Nothing on screen changes yet.',
  ],
}

export default note
