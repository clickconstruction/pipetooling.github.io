import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8548',
  date: '2026-11-24',
  title: 'Bill Customer: the bill’s face shows the Service address line the made bill carries',
  kind: 'fix',
  highlights: [
    'A made Stripe bill’s memo opens with Service address and the job’s address. The face of the bill left that line out.',
    'The face now shows the memo as the bill will hold it: the address line first, then your own memo.',
    'The same goes for the window that turns a recorded bill into a Stripe bill.',
  ],
}

export default note
