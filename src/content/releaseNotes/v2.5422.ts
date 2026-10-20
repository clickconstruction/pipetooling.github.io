import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5422',
  date: '2026-10-12',
  title: 'Customers: a place to keep the language a customer reads, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A customer can now keep a language, English or Spanish. Every customer reads English until the office says otherwise.',
    'Nothing sets it or reads it yet, and nothing on screen changes. Spanish still waits until a native speaker reads the words.',
  ],
}

export default note
