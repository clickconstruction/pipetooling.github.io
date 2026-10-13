import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5437',
  date: '2026-10-13',
  title: 'Messages: a customer’s own thread can be opened from their name, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The office can now open a thread for any of our own customers, not only those on GC projects.',
    'The first time, the app starts the thread with the number and the address on file.',
    'A customer deleted from Customers keeps their thread under their name.',
    'Nothing on screen changes yet. A Messages button beside a customer’s name comes next.',
  ],
}

export default note
