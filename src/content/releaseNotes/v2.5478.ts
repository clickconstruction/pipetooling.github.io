import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5478',
  date: '2026-10-13',
  title: 'Messages: the server can work out who hears a reply, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules for who has a reply, who gets a new message and a reply after a legal letter now run on the server too.',
    'This readies the phone alert for a customer’s reply. Nothing on screen changes.',
  ],
}

export default note
