import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5415',
  date: '2026-10-12',
  title: 'Messages: who hears a customer’s reply as a push, and when, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'When a customer answers a tech’s text, the tech will get a push at once.',
    'The office hears after 15 minutes when nobody has answered, and at once after hours.',
    'A reply to a lien letter goes to the office alone. Nothing on screen changes yet.',
  ],
}

export default note
