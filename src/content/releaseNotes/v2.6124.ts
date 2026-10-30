import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6124',
  date: '2026-10-30',
  title: 'A session can sign the Claude app’s browser into the deployed app without asking',
  kind: 'feature',
  highlights: [
    'A small repo script prints a one-time sign-in link for clicktooling.com, made the same way the dev server’s password-free login is made, so a Claude session can open it in its browser pane and check the deployed app without stopping to ask for a password.',
    'The pane stays signed in across app restarts, and the link dies on first use. Nothing new is stored: the script reads the secret the dev login already keeps on the machine.',
    'The rule for a session on the live app is written down with it: read what the task needs, make test rows only under the ZZ test name and delete them before the session ends, and never touch a real customer’s or person’s row.',
  ],
}

export default note
