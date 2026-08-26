import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2343',
  date: '2026-08-26',
  title: 'Email payment card: corners and rule polished',
  kind: 'fix',
  highlights: [
    'The payment card in invoice emails now shows its rounded corners in every mail client, and the rule above Balance due stops short of the card edges instead of running edge to edge.',
  ],
}

export default note
