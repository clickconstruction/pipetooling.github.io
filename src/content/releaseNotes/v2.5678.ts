import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5678',
  date: '2026-10-20',
  title: 'Pricing: the big Revenue number carries its cents',
  kind: 'feature',
  highlights: [
    'On the Pricing tab the Revenue and Profit numbers above the price book rounded to whole dollars, so they could disagree with the price card and the GC’s letter — a book total of $83,117.65 read $83,118, a figure that existed nowhere else on the page.',
    'They now show the exact figure with the cents in smaller type, the same way the price cards do, so the big number always matches the card and the letter to the cent.',
    'A bid with an alternate gets the same on its Base, + alternate and With-the-alternate numbers, so that line sums exactly.',
  ],
}

export default note
