import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5479',
  date: '2026-10-13',
  title: 'Messages: a customer’s reply can reach whoever has it as a phone alert, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The server can now tell the tech who texted a customer, or the office, when that customer writes back.',
    'The office hears after a short wait when nobody has answered, and at once after hours.',
    'A reply after a lien letter goes to the office alone.',
    'Nothing sends yet. A switch that ships off turns it on later.',
  ],
}

export default note
