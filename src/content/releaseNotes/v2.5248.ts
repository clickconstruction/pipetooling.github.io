import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5248',
  date: '2026-10-12',
  title: 'Messages: the rules for Bill day from the trades',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Nothing changes on screen. The app now reads each trade’s draw against bill day: sent back, not in, waiting on us, approved or closing out.',
    'Seven gates say whether the pay application can go. A first pay application no longer waits on a certificate it cannot have.',
    'A draw is priced at what the superintendent saw, the same way the Draws window approves it. Her walk never shows a dollar.',
    'The texts that ask a trade for its draw, its waiver or a fix are written out, each its own.',
  ],
}

export default note
