import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3762',
  date: '2026-09-23',
  title: 'The Pipeline on a phone: one stage at a time, one line per job, swipe to advance',
  kind: 'feature',
  highlights: [
    'On a phone the Pipeline opens on the list. Stage chips (Waiting · Working · Ready · Billed · Coll.) stay pinned under the page tabs and show one stage at a time; the map, the money tiles and Today’s money opportunities fold into one Overview at the bottom, closed until you open it.',
    'A job is two lines and at most one chip: who and where, then the next block and its crew, and the one thing that is next or wrong — no bid value, set % done, quiet N days, N days past expected, no contract, a draw ready, done-not-billed money. Tap the chip and it opens the fix. Needs me shows only the rows with a red or amber chip; Today the rows with a block today.',
    'No live status button on a touch screen: swipe a row to the right to uncover the stage’s next move, and it always confirms — the same Ready to bill questions, Bill Customer and Mark paid windows as on the desktop, with one new line on top that states the money, the agreement and the schedule the move leaves in place. Hold a row for the ⋯ sheet.',
    'A fix on the phone cards’ bill rows: the big button read “Delete draft bill” or “Send back” while it actually billed or marked paid. It now says what it does, and the send-back words are in the ⋯ sheet.',
  ],
}

export default note
