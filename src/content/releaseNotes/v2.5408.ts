import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5408',
  date: '2026-10-12',
  title: 'Three Stripe server functions pass their own type check again',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The server code behind creating a Stripe bill, previewing one, and sending a bill back to be billed again is checked cleanly by the server’s own type checker.',
    'Nothing any of them does changes.',
  ],
}

export default note
