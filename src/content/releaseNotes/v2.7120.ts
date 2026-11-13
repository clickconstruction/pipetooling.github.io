import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7120',
  date: '2026-11-13',
  title: 'The Bridge’s Market window: press an amount to see what makes it up',
  kind: 'feature',
  highlights: [
    'In the Market window, the bids’ amount and the estimates’ amount are now presses. Each opens a window of its own over the Market window.',
    'The bids’ window has a row for each size of bid: what went out a week, the won rate, and what that wins. The estimates’ window shows approved, declined, passed over, no answer and still out.',
    'Press a row to see the bids or estimates behind it by name, the largest first. Press a name to open that bid or that estimate.',
    'Esc or a press outside closes the second window and leaves the Market window open.',
  ],
}

export default note
