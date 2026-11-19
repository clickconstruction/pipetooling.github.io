import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7931',
  date: '2026-11-19',
  title: 'The money desks close to a primary',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'Bank payments, returned checks and disputes were open to a primary in the database. No screen of a primary’s showed them.',
    'Now those desks are the office’s alone.',
    'A primary’s own jobs still show when each bill is expected to be paid. The office works as before.',
  ],
}

export default note
