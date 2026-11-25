import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8609',
  date: '2026-11-25',
  title: 'The bids of the day: the app notes the bid you are at work on',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen yet. This is the second step of the list that will fill itself in at clock out.',
    'While a bid is open on the Bids page and you are pressing, typing or scrolling, the app adds that time to the bid, a minute at a time.',
    'A tab left open with nobody at it stops counting after five minutes. A glance at a bid on the way to another counts for nothing.',
    'You read your own. The owner and a dev read it too, and nobody else unless the owner grants it.',
  ],
}

export default note
