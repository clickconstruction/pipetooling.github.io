import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5359',
  date: '2026-10-12',
  title: 'Seven more server functions pass their own type check again',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The server code that declines an estimate, sorts bank transactions, emails field reports, sends Stripe bills, shares a signed agreement, signs in the bid room and takes a portal request is checked cleanly by the server’s own type checker.',
    'Nothing any of them does changes.',
  ],
}

export default note
