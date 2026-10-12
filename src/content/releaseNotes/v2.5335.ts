import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5335',
  date: '2026-10-12',
  title: 'Messages: a place in Settings for whose phone seat is whose, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The app now keeps which company phone seat belongs to which person, ready for Settings → Phone and texts.',
    'Only the owner or a dev can change it. Nothing on screen changes yet.',
  ],
}

export default note
