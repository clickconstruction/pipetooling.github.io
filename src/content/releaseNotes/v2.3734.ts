import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3734',
  date: '2026-09-22',
  title: 'Send the run: each envelope is a card on a phone',
  kind: 'fix',
  highlights: [
    'On a phone the run’s envelope table was squeezed — the job names broke one word per line and the tracking box sat off the right edge. Each envelope now stacks as a card: who it goes to, then Method and Tracking # with their own labels, then the notices inside it.',
    'The footer reads in order on a phone too: the hint, then Print the packet, then Record the run.',
    'Tablet and desktop are unchanged.',
  ],
}

export default note
