import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5412',
  date: '2026-10-12',
  title: 'Five more server functions pass their own type check again',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The server code behind scanning Drive for contracts, the contract signing page, a customer opening a test report, the submittal room and email delivery reports is checked cleanly by the server’s own type checker.',
    'Nothing any of them does changes.',
  ],
}

export default note
