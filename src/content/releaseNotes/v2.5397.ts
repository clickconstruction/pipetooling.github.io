import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5397',
  date: '2026-10-12',
  title: 'Archiving a login bans its sign-in',
  kind: 'fix',
  roles: ['dev', 'controller', 'master_technician'],
  highlights: [
    'Archiving someone now stops their login signing in, as it was always meant to. The ban had never reached the sign-in service.',
    'A duplicate login merged into another account is banned the same way.',
    'Restoring an account lifts the ban, so they can sign in again.',
  ],
}

export default note
