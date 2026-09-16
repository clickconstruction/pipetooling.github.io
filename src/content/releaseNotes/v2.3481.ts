import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3481',
  date: '2026-09-15',
  title: 'The first price on a bid freezes it — book edits no longer reach a bid that never picked a book',
  kind: 'fix',
  highlights: [
    'A new bid showed your book\'s prices before anyone picked a book, and every price you assigned or typed was keyed to the shared book itself — so editing the book later re-priced the bid, sent or not.',
    'Now the first price on a bid (assign a row, type a price, fill from the book, apply the solver or the margin brush) takes the bid\'s own copy of that book on the spot — a toast says so — and every price after it lands on the copy.',
    'The price book drawer says which case you are in: "its own copy taken when it was first priced", or "no copy yet — the first price you assign takes one".',
    'Bids that already own a copy are untouched, and robot bids keep pricing on the robot book.',
  ],
}

export default note
