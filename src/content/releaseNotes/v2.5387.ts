import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5387',
  date: '2026-10-13',
  title: 'Settings: a developer sets up the certified-mail service from the app (Docsmit train, PR 9, migration 20261013160000)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Settings → Developer gains a Docsmit block: the account email, the password, the software id and which Docsmit, the sandbox or the live site. The password is turned into its hash in the browser and only the hash is kept, in the vault.',
    'The same block holds the switches: paused, which door a run opens on, the return receipt, the cutoff, the send-by buffer, the credit warning, the poll, and whether the poll records what was sent by hand on Docsmit’s site.',
    'Test the connection asks Docsmit for the account’s name and balance. Poll now runs the hourly read-back at once.',
    'The mail functions now read the vault first, then their own settings, so a connection set here wins.',
  ],
}

export default note
