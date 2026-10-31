import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6240',
  date: '2026-10-31',
  title: 'Three more server functions pass their own type check again',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The server code behind the lien notice push to a leader, and the email and the push a filed report sends, is checked cleanly by the server’s own type checker.',
    'Nothing any of them does changes.',
  ],
}

export default note
