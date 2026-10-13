import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5484',
  date: '2026-10-13',
  title: 'Messages: turn on the reply push from Settings',
  kind: 'feature',
  roles: ['dev', 'master_technician'],
  highlights: [
    'Settings → Phone and texts has a Reply push switch for the owner and a dev. It asks before it turns the push on.',
    'On, a reply from a customer, a lead or a sub reaches the phone of whoever has the conversation within a minute.',
    'The card says what the switch means in words, on or off.',
  ],
}

export default note
