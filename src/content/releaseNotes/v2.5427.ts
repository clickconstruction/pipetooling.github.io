import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5427',
  date: '2026-10-12',
  title: 'Messages: who has a conversation can be read by the server, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The shape of who has a conversation moved to a file of its own, so the server’s copy of the rules can read it.',
    'The push that tells a tech or the office about a customer’s reply needs it.',
    'Nothing anyone sees changes.',
  ],
}

export default note
