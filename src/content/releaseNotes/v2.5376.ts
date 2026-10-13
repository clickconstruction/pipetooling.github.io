import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5376',
  date: '2026-10-12',
  title: 'Five more server functions pass their own type check again',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The server code behind the dev seat, putting an address on the map, reading a Stripe bill’s details, the dispatch request pushes and the try-out push is checked cleanly by the server’s own type checker.',
    'Nothing any of them does changes.',
  ],
}

export default note
