import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3254',
  date: '2026-09-10',
  title: "Changing a user's role works again",
  kind: 'fix',
  highlights: [
    'Active Accounts: changing a role, toggling training mode, or editing a user\'s notes showed a red "infinite recursion detected in policy for relation users" line and saved nothing. Every one of those writes had been failing since September 3.',
    'The database rule that decides who may edit user accounts was rewritten on September 3 to admit controllers and, in the process, looked itself up in a way Postgres refuses. It now goes through the same helper it used before, with controllers included.',
    'Nothing changed about who may do what: only a dev changes roles; a dev, controller, or pay-approved master sets training mode (never on their own account).',
  ],
}

export default note
