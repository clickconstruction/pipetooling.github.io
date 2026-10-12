import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5321',
  date: '2026-10-12',
  title: 'Messages: a message we send can mark what we owe done, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'When a text or an email we send gets what we owe someone done, the app can now mark it done by that message.',
    'The thread says who sent it and that it is done. Nothing on screen changes yet.',
  ],
}

export default note
