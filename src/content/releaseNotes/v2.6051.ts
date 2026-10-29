import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6051',
  date: '2026-10-29',
  title: 'Pairing a bid with its job shows what changes before it writes',
  kind: 'feature',
  highlights: [
    'On the Development page, every pairing press now opens a window first: Pair, Pair the N likely pairs, Unpair, and Mark the N paired bids won. The window shows each fact now and after, marks the ones that change, and reads the row as Pieces or the Bid Board will show it. The button carries the verb.',
    'The message after each write offers the way back: Unpair after a pair, Unpair the N after the counted press, Put it back after an unpair, and Undo after the won press.',
    'The won press reads Marked 2 bids won, and names a bid that did not take with its reason.',
  ],
}

export default note
