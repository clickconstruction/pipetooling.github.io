import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4607',
  date: '2026-10-05',
  title: 'Help: the plain-words check reads a table row by its own words',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The check that holds every help guide to plain words no longer counts a table’s dividing lines as words. A table row is held to its own words.',
    'A table cell that holds only a dash reads as an empty cell, not as two ideas glued together.',
  ],
}

export default note
