import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5424',
  date: '2026-10-12',
  title: 'Messages: every person at a customer reads the customer’s language, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A customer’s language now reaches every person at that customer. Nothing guesses it from a name.',
    'A quick reply goes in Spanish only when the customer reads Spanish and Spanish is turned on. A reply with no Spanish goes in English.',
    'Spanish stays off until a native speaker reads the words. Nothing on screen changes yet.',
  ],
}

export default note
