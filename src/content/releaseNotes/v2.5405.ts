import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5405',
  date: '2026-10-12',
  title: 'Dispatch: what slides when a tech is running late, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'When a tech tells a customer a new window, the app can read which of their later stops slide and by how much.',
    'The slide stops at the first gap in the day that takes the delay.',
    'The send will ask once: Move the board too? It names what moves and offers Move it or Leave the board.',
    'Nothing on screen changes yet.',
  ],
}

export default note
