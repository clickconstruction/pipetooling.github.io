import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4926',
  date: '2026-10-08',
  title: 'GC mode: change orders to the customer, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A won job on GC projects has a Change orders button. It opens a window to write a change order, send it to the customer and record their answer.',
    'The price starts at the cost plus our fee, and the office can type over it. A credit takes work out.',
    'Once sent, a change order keeps what it said. A signed one adds its price and its days, and you pick how much of its work is done.',
    'Only a dev sees it while GC mode is built.',
  ],
}

export default note
