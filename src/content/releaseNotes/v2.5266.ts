import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5266',
  date: '2026-10-12',
  title: 'Messages: the phone webhook checks that each call and text came from Quo, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules are ready for the webhook that takes calls and texts from Quo. It refuses anything Quo did not sign.',
    'A delivery Quo sends twice is taken once. A failure asks Quo to send it again.',
    'Nothing on screen changes yet.',
  ],
}

export default note
