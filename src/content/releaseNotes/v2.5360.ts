import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5360',
  date: '2026-10-12',
  title: 'Four server functions name every field they read, and pass their type check again',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The server code that emails a bill with its copies, asks supply houses for prices, records a card payment from Stripe and sends a test email is checked cleanly by the server’s own type checker.',
    'Each field it reads was already sent by the app or taken by the database. Nothing any of them does changes.',
  ],
}

export default note
