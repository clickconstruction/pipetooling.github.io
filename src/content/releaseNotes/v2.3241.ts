import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3241',
  date: '2026-09-10',
  title: 'The bid flow folds into the title row on the workflow tabs',
  kind: 'feature',
  highlights: [
    'On Counts, Takeoffs, Labor, Pricing and Cover Letter the flow strip no longer takes a card of its own above the bid. It sits beside the bid’s name as one line: the ten ticks, “7 of 10 done · decided”, and the review stamp. About 200 pixels back on every bid.',
    'Tap the line to unfold the full strip with its phase labels and doors; tap again to fold it. Your device remembers which you prefer, the way the Solver fold does.',
    'Mark reviewed stays one tap away: while a bid is unreviewed, the button sits right beside the line.',
    'The Bid Board’s expanded row keeps the full strip — that is where you open a bid to see where it is.',
  ],
}

export default note
