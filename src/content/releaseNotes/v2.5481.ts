import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5481',
  date: '2026-10-13',
  title: 'Messages: a switch for the reply alerts, which ships off',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Once the owner turns it on, the server checks every minute for customer replies that need an alert.',
    'It ships off, so nothing sends until then.',
  ],
}

export default note
