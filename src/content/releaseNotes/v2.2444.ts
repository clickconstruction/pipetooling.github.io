import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2444',
  date: '2026-08-28',
  title: 'Change a price in the book, carry it to the bid you have open',
  kind: 'fix',
  highlights: [
    'Every bid keeps its own copy of the price book, taken when the bid started — that is what stops a sent bid re-pricing itself because someone tidied the book. The drawer now says so on every book, instead of only when you were looking at a different one.',
    'Change a price in the book with a bid open and the drawer offers the door across: "This bid still prices Ft of Water Line at $12" — press Use $13.00 on this bid and every row already assigned to it re-prices on the spot. Add an entry your bid has never seen and you get Add it to this bid too, so it turns up when you assign a row.',
    'Nothing is carried across unless you press it, and no other bid is ever touched.',
    'Fixed a bid landing on the wrong price book: deleting a price option used to sever the trail back to the book it came from, so the drawer opened somebody else\'s book, no book wore the ★, and "Use … on this bid" would have built a third copy with none of your assignments on it.',
  ],
}

export default note
