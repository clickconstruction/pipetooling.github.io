import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5401',
  date: '2026-10-12',
  title: 'Eight more server functions pass their own type check again',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The server code behind adding a user, setting a password, signing in as someone, the developer sign-ins, and the checklist, workflow and reminder notices is checked cleanly by the server’s own type checker.',
    'Nothing any of them does changes.',
  ],
}

export default note
