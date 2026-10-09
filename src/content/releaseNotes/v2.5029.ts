import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5029',
  date: '2026-10-09',
  title: 'The controller sees how fast customers pay, and their promises',
  kind: 'fix',
  roles: ['controller'],
  highlights: [
    'Bill the customer and Money in GC projects now use the customer’s usual days to pay and their promises for the controller too. The days a bill is due match what a dev sees.',
    'The controller can record when a customer says they will pay, with They said when.',
  ],
}

export default note
