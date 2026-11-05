import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6528',
  date: '2026-11-04',
  title: 'Archiving finds the person by who they are, not by their email',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Archive, End employment and the twins’ fleet archive now name the person by their row, so someone with no login and no email can be archived too, and two people who share a name never get mixed up.',
    'The rules behind Attach a login live in one place with their own tests: who may be attached, who is refused and why, and what the sign-in is made with.',
  ],
}

export default note
