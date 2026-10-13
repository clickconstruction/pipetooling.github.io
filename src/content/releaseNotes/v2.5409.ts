import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5409',
  date: '2026-10-12',
  title: 'The law firm’s portal passes its own type check again',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The server code behind the page a law firm opens to work our matters is checked cleanly by the server’s own type checker.',
    'Every column it reads was checked against the database and is there. Nothing it does changes.',
  ],
}

export default note
