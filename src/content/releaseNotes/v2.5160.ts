import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5160',
  date: '2026-10-10',
  title: 'GC mode: our contract to the customer, sent and signed, in the database',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Our contract to a GC customer can now be sent to sign, with its price and the file it goes with.',
    'The customer signs the newest one in their portal, and the price kept is the one they read.',
    'A contract they signed in their portal cannot be undone or moved on Get started.',
    'Nothing on screen changes yet.',
  ],
}

export default note
