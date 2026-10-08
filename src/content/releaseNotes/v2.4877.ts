import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4877',
  date: '2026-10-07',
  title: 'People: only a dev is offered Invite as user',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On People → Users, the ⋯ menu offers Invite as user to a dev only. Only a dev can make a login, so the button failed for everyone else.',
    'On a person’s desk, a missing login now reads Ask a dev to invite for anyone but a dev.',
  ],
}

export default note
