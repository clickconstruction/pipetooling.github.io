import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5400',
  date: '2026-10-12',
  title: 'Four contract server functions pass their own type check again',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The server code behind signing a contract or form, the office’s half of a two-party form, entering a form from paper and a trade partner signing on its portal is checked cleanly by the server’s own type checker.',
    'Nothing any of them does changes. The cursive signature font loads as before.',
  ],
}

export default note
