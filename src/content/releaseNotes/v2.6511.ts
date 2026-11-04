import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6511',
  date: '2026-11-04',
  title: 'A person can be on the roster before they have a login, and keep their days when a login goes away',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The database no longer requires a sign-in behind every person: a row for a worker can exist with no login, and a login can be attached to it later without moving anything that points at them.',
    'Removing someone’s login now leaves the person and their clock sessions in place. Before, deleting a login took the person’s days with it.',
    'Nothing on screen changes yet. The next steps add people without a login from People, give the ones already on the roster their row, and put Attach a login on the person’s desk.',
  ],
}

export default note
